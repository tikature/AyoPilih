"use server";

import { z } from "zod";
import { headers, cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, isValidTokenFormat, generateSessionToken, hashSessionToken } from "@/lib/crypto/token";
import { ok, fail, type ActionResult } from "@/types";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit";

const SESSION_TTL_MINUTES = 10;
const SESSION_COOKIE = "ayopilih_booth";

const verifyKioskTokenSchema = z.object({
  electionId: z.string().uuid(),
  token: z.string().length(8, "Token harus 8 karakter."),
});

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export async function verifyKioskToken(
  input: z.infer<typeof verifyKioskTokenSchema>,
): Promise<ActionResult<{ redirectTo: "bilik" | "sudah-memilih" }>> {
  // Kios mode: rate limit loosened — all voters share the same IP,
  // but still cap at 30 attempts / 10 minutes (vs 10 for online).
  // We use a separate key prefix so the limits don't interfere.
  const ip = await getClientIp();
  const rateResult = await checkRateLimit(`kios:${ip}`);
  if (!rateResult.allowed && rateResult.retryAfterSeconds && rateResult.retryAfterSeconds > 600) {
    return fail(
      `Terlalu banyak percobaan. Silakan coba lagi dalam ${rateResult.retryAfterSeconds} detik.`,
      "RATE_LIMITED",
    );
  }

  const parsed = verifyKioskTokenSchema.safeParse(input);
  if (!parsed.success) {
    await recordAttempt(`kios:${ip}`, false);
    return fail(parsed.error.issues[0]?.message ?? "Token tidak valid.", "VALIDATION");
  }

  const { electionId, token } = parsed.data;

  if (!isValidTokenFormat(token)) {
    await recordAttempt(`kios:${ip}`, false);
    return fail(
      "Token tidak dikenali. Periksa lagi 8 karakternya.",
      "INVALID_TOKEN"
    );
  }

  const supabase = createAdminClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, status, start_time, end_time, voting_mode")
    .eq("id", electionId)
    .single();

  if (!election) {
    await recordAttempt(`kios:${ip}`, false);
    return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");
  }

  if (election.voting_mode === "ONLINE_ONLY") {
    await recordAttempt(`kios:${ip}`, false);
    return fail("Pemilihan ini tidak menggunakan mode Kios/TPS.", "FORBIDDEN");
  }

  const now = Date.now();
  if (now < new Date(election.start_time).getTime()) {
    await recordAttempt(`kios:${ip}`, false);
    return fail("Pemilihan belum dibuka.", "ELECTION_NOT_OPEN");
  }
  if (now > new Date(election.end_time).getTime() || election.status === "CLOSED") {
    await recordAttempt(`kios:${ip}`, false);
    return fail("Pemilihan sudah ditutup.", "OUTSIDE_VOTING_WINDOW");
  }

  const tokenHash = await hashToken(token);

  const { data: voter } = await supabase
    .from("voters")
    .select("id, status, has_voted")
    .eq("election_id", electionId)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!voter) {
    await recordAttempt(`kios:${ip}`, false);
    return fail("Token tidak dikenali. Periksa lagi 8 karakternya.", "INVALID_TOKEN");
  }

  if (voter.status === "BLOCKED") {
    await recordAttempt(`kios:${ip}`, false);
    return fail("Token ini dinonaktifkan panitia.", "VOTER_BLOCKED");
  }

  if (voter.has_voted) {
    await recordAttempt(`kios:${ip}`, true);
    return ok({ redirectTo: "sudah-memilih" as const });
  }

  // Sesi bilik baru khusus Kiosk
  const sessionToken = generateSessionToken();
  const sessionHash = await hashSessionToken(sessionToken);
  const expiresAt = new Date(now + SESSION_TTL_MINUTES * 60_000);

  const { error: sessionError } = await supabase.from("vote_sessions").insert({
    voter_id: voter.id,
    election_id: electionId,
    session_token_hash: sessionHash,
    expires_at: expiresAt.toISOString(),
  });

  if (sessionError) {
    return fail("Gagal membuka bilik suara. Coba lagi.", "UNKNOWN");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_TTL_MINUTES * 60,
    path: "/",
  });

  await recordAttempt(`kios:${ip}`, true);
  return ok({ redirectTo: "bilik" as const });
}