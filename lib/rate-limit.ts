import "server-only";

/**
 * Token verification rate limiter.
 *
 * SECURITY.md §4:
 *   - Per IP: 10 attempts / 10 minutes
 *   - After 5 consecutive failures from one IP: 60 second backoff
 *
 * Strategy:
 *   1. Try Upstash Redis if UPSTASH_REDIS_REST_URL is set.
 *   2. Otherwise, fall back to Supabase Postgres table `rate_limits`.
 *
 * Both implementations expose identical interface: `checkRateLimit(key)` and `recordAttempt(key, success)`.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const HAS_UPSTASH = !!process.env.UPSTASH_REDIS_REST_URL;

export interface RateCheckResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining: number;
}

// ------------------- Upstash Redis Implementation -------------------

async function upstashGet(key: string): Promise<string | null> {
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.result;
}

async function upstashSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([value, "EX", ttlSeconds]),
  });
}



// ------------------- Postgres (Supabase) Implementation -------------------

interface RateLimitRecord {
  key: string;
  count: number;
  first_at: string;
  last_at: string;
  consecutive_failures: number;
  backoff_until: string | null;
}

async function pgGet(key: string): Promise<RateLimitRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rate_limits")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return null;
  return data as RateLimitRecord;
}

async function pgUpsert(
  key: string,
  count: number,
  firstAt: Date,
  lastAt: Date,
  consecutiveFailures: number,
  backoffUntil: Date | null,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("rate_limits").upsert({
    key,
    count,
    first_at: firstAt.toISOString(),
    last_at: lastAt.toISOString(),
    consecutive_failures: consecutiveFailures,
    backoff_until: backoffUntil?.toISOString() ?? null,
  });
  if (error) console.error("[RateLimit PG Upsert Error]", error);
}

async function pgPruneStale(): Promise<void> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 11 * 60 * 1000).toISOString(); // window + 1 min buffer
  await supabase.from("rate_limits").delete().lt("first_at", cutoff);
}

// ------------------- Unified Interface -------------------

export interface RateCheckResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining: number;
}

export async function checkRateLimit(key: string): Promise<RateCheckResult> {
  if (HAS_UPSTASH) {
    return upstashCheckRateLimit(key);
  }
  return pgCheckRateLimit(key);
}

export async function recordAttempt(key: string, success: boolean): Promise<void> {
  if (HAS_UPSTASH) {
    await upstashRecordAttempt(key, success);
  } else {
    await pgRecordAttempt(key, success);
  }
}

// ------------------- Upstash Implementation -------------------

async function upstashCheckRateLimit(key: string): Promise<RateCheckResult> {
  const raw = await upstashGet(key);
  if (!raw) return { allowed: true, remaining: 10 };

  const rec = JSON.parse(raw) as {
    count: number;
    firstAt: number;
    lastAt: number;
    consecutiveFailures: number;
    backoffUntil?: number;
  };

  const now = Date.now();
  const windowMs = 10 * 60 * 1000;

  // Backoff check
  if (rec.backoffUntil && now < rec.backoffUntil) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((rec.backoffUntil - now) / 1000),
      remaining: 0,
    };
  }

  // Window expired
  if (now - rec.firstAt > windowMs) {
    return { allowed: true, remaining: 10 };
  }

  // Within window
  if (rec.count >= 10) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((windowMs - (now - rec.firstAt)) / 1000),
      remaining: 0,
    };
  }

  return { allowed: true, remaining: 10 - rec.count };
}

async function upstashRecordAttempt(key: string, success: boolean): Promise<void> {
  const raw = await upstashGet(key);
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;

  if (!raw) {
    await upstashSet(
      key,
      JSON.stringify({
        count: 1,
        firstAt: now,
        lastAt: now,
        consecutiveFailures: success ? 0 : 1,
        backoffUntil: success ? undefined : (now + 60_000),
      }),
      600, // 10 min TTL
    );
    return;
  }

  const rec = JSON.parse(raw) as {
    count: number;
    firstAt: number;
    lastAt: number;
    consecutiveFailures: number;
    backoffUntil?: number;
  };

  // Window expired
  if (now - rec.firstAt > windowMs) {
    await upstashSet(
      key,
      JSON.stringify({
        count: 1,
        firstAt: now,
        lastAt: now,
        consecutiveFailures: success ? 0 : 1,
        backoffUntil: success ? undefined : (now + 60_000),
      }),
      600,
    );
    return;
  }

  rec.count++;
  rec.lastAt = now;

  if (success) {
    rec.consecutiveFailures = 0;
    rec.backoffUntil = undefined;
  } else {
    rec.consecutiveFailures++;
    if (rec.consecutiveFailures >= 5) {
      rec.backoffUntil = now + 60_000;
    }
  }

  const ttl = Math.ceil((rec.firstAt + windowMs - now) / 1000);
  await upstashSet(key, JSON.stringify(rec), Math.max(ttl, 1));
}

// ------------------- Postgres Implementation -------------------

async function pgCheckRateLimit(key: string): Promise<RateCheckResult> {
  await pgPruneStale();
  const rec = await pgGet(key);
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;

  if (!rec) return { allowed: true, remaining: 10 };

  // Backoff check
  if (rec.backoff_until && new Date(rec.backoff_until).getTime() > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((new Date(rec.backoff_until).getTime() - now) / 1000),
      remaining: 0,
    };
  }

  // Window expired
  if (now - new Date(rec.first_at).getTime() > windowMs) {
    return { allowed: true, remaining: 10 };
  }

  // Within window
  if (rec.count >= 10) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((windowMs - (now - new Date(rec.first_at).getTime())) / 1000),
      remaining: 0,
    };
  }

  return { allowed: true, remaining: 10 - rec.count };
}

async function pgRecordAttempt(key: string, success: boolean): Promise<void> {
  const rec = await pgGet(key);
  const now = new Date();
  const windowMs = 10 * 60 * 1000;

  if (!rec) {
    await pgUpsert(key, 1, now, now, success ? 0 : 1, success ? null : new Date(now.getTime() + 60_000));
    return;
  }

  // Window expired
  if (now.getTime() - new Date(rec.first_at).getTime() > windowMs) {
    await pgUpsert(key, 1, now, now, success ? 0 : 1, success ? null : new Date(now.getTime() + 60_000));
    return;
  }

  await pgUpsert(
    key,
    rec.count + 1,
    new Date(rec.first_at),
    now,
    success ? 0 : rec.consecutive_failures + 1,
    success
      ? null
      : rec.consecutive_failures + 1 >= 5
        ? new Date(now.getTime() + 60_000)
        : rec.backoff_until ? new Date(rec.backoff_until) : null,
  );
}

/** Test/debug helper: clear all stored state. */
export async function __resetRateLimit(): Promise<void> {
  if (HAS_UPSTASH) {
    // Upstash doesn't support pattern delete easily; manual clear via CLI if needed
    return;
  }
  const supabase = createAdminClient();
  await supabase.from("rate_limits").delete().neq("key", "");
}