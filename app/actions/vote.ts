"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashToken,
  isValidTokenFormat,
  generateSessionToken,
  hashSessionToken,
  generateVoteHash,
  formatReceipt,
} from "@/lib/crypto/token";
import { ok, fail, type ActionResult } from "@/types";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit";

/**
 * The heart of AyoPilih.
 *
 * Non-negotiable rules (SECURITY.md):
 *  - Nothing here ever writes a voter identifier into `votes`.
 *  - Nothing here ever logs a voter id together with a candidate id.
 *  - The plaintext token never leaves this module.
 */

const SESSION_TTL_MINUTES = 10;
const SESSION_COOKIE = "ayopilih_booth";

import { verifyTokenSchema, submitVoteSchema, verifyReceiptSchema } from "@/lib/schemas/vote";

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

// ---------------------------------------------------------------------
// verifyToken — exchanges a voter token for a short-lived booth session
// ---------------------------------------------------------------------
export async function verifyToken(
  input: z.input<typeof verifyTokenSchema>,
): Promise<ActionResult<{ redirectTo: "bilik" | "sudah-memilih" }>> {
  // Rate limiting per IP for token verification
  const ip = await getClientIp();
  const rateResult = await checkRateLimit(`verify-token:${ip}`);
  if (!rateResult.allowed) {
    return fail(
      `Terlalu banyak percobaan. Silakan coba lagi dalam ${rateResult.retryAfterSeconds} detik.`,
      "RATE_LIMITED",
    );
  }

  const parsed = verifyTokenSchema.safeParse(input);
  if (!parsed.success) {
    await recordAttempt(`verify-token:${ip}`, false);
    return fail(
      parsed.error.issues[0]?.message ?? "Token tidak valid.",
      "VALIDATION",
      "token",
    );
  }

  const { electionId, token } = parsed.data;

  if (!isValidTokenFormat(token)) {
    await recordAttempt(`verify-token:${ip}`, false);
    return fail(
      "Token tidak dikenali. Periksa lagi 8 karakternya, atau hubungi panitia untuk token baru.",
      "INVALID_TOKEN",
      "token",
    );
  }

  const supabase = createAdminClient();

  // Election must be open before we even look at the token.
  const { data: election } = await supabase
    .from("elections")
    .select("id, status, start_time, end_time")
    .eq("id", electionId)
    .single();

  if (!election) {
    await recordAttempt(`verify-token:${ip}`, false);
    return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");
  }

  const now = Date.now();
  if (now < new Date(election.start_time).getTime()) {
    await recordAttempt(`verify-token:${ip}`, false);
    return fail(
      "Pemilihan belum dibuka. Silakan kembali sesuai jadwal yang tertera.",
      "ELECTION_NOT_OPEN",
    );
  }
  if (now > new Date(election.end_time).getTime() || election.status === "CLOSED") {
    await recordAttempt(`verify-token:${ip}`, false);
    return fail(
      "Pemilihan sudah ditutup. Hasil dapat dilihat di halaman hasil.",
      "OUTSIDE_VOTING_WINDOW",
    );
  }

  const tokenHash = await hashToken(token);

  const { data: voter } = await supabase
    .from("voters")
    .select("id, status, has_voted")
    .eq("election_id", electionId)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!voter) {
    await recordAttempt(`verify-token:${ip}`, false);
    return fail(
      "Token tidak dikenali. Periksa lagi 8 karakternya, atau hubungi panitia untuk token baru.",
      "INVALID_TOKEN",
      "token",
    );
  }

  if (voter.status === "BLOCKED") {
    await recordAttempt(`verify-token:${ip}`, false);
    return fail(
      "Token ini dinonaktifkan panitia. Silakan hubungi panitia pemilihan.",
      "VOTER_BLOCKED",
    );
  }

  if (voter.has_voted) {
    await recordAttempt(`verify-token:${ip}`, true);
    return ok({ redirectTo: "sudah-memilih" as const });
  }

  // Issue a booth session.
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
    return fail("Gagal membuka bilik suara. Coba lagi sebentar.", "UNKNOWN");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_TTL_MINUTES * 60,
    path: "/",
  });

  await recordAttempt(`verify-token:${ip}`, true);
  return ok({ redirectTo: "bilik" as const });
}

// ---------------------------------------------------------------------
// getBoothSession — used by the booth page to confirm access
// ---------------------------------------------------------------------
export async function getBoothSession(
  electionId: string,
): Promise<ActionResult<{ voterId: string; expiresAt: string }>> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return fail("Sesi belum dimulai. Masukkan token dulu.", "SESSION_EXPIRED");
  }

  const supabase = createAdminClient();
  const sessionHash = await hashSessionToken(sessionToken);

  const { data: session } = await supabase
    .from("vote_sessions")
    .select("voter_id, election_id, expires_at, used")
    .eq("session_token_hash", sessionHash)
    .maybeSingle();

  if (!session || session.election_id !== electionId) {
    return fail("Sesi tidak valid. Masukkan token lagi.", "SESSION_EXPIRED");
  }
  if (session.used) {
    return fail("Sesi ini sudah dipakai.", "ALREADY_VOTED");
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    return fail(
      "Waktu di bilik suara habis. Masukkan token lagi untuk melanjutkan.",
      "SESSION_EXPIRED",
    );
  }

  return ok({ voterId: session.voter_id, expiresAt: session.expires_at });
}

// ---------------------------------------------------------------------
// submitVote — atomic, idempotent, anonymous
// ---------------------------------------------------------------------
export async function submitVote(
  input: z.input<typeof submitVoteSchema>,
): Promise<ActionResult<{ receipt: string }>> {
  const parsed = submitVoteSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Pilihan tidak valid.", "VALIDATION");
  }
  const { electionId, candidateId } = parsed.data;

  const sessionResult = await getBoothSession(electionId);
  if (!sessionResult.ok) return sessionResult;

  const { voterId } = sessionResult.data;
  const supabase = createAdminClient();
  const voteHash = await generateVoteHash(electionId);

  // All the checking, inserting and flagging happens inside one locked
  // transaction in Postgres. See cast_vote() in DATABASE_SCHEMA.sql.
  const { error } = await supabase.rpc("cast_vote", {
    p_voter_id: voterId,
    p_election_id: electionId,
    p_candidate_id: candidateId,
    p_vote_hash: voteHash,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("ALREADY_VOTED")) {
      return fail("Token ini sudah dipakai untuk memilih.", "ALREADY_VOTED");
    }
    if (message.includes("VOTER_BLOCKED")) {
      return fail("Token ini dinonaktifkan panitia.", "VOTER_BLOCKED");
    }
    if (message.includes("OUTSIDE_VOTING_WINDOW")) {
      return fail("Waktu pemilihan sudah berakhir.", "OUTSIDE_VOTING_WINDOW");
    }
    if (message.includes("ELECTION_NOT_OPEN")) {
      return fail("Pemilihan sedang tidak dibuka.", "ELECTION_NOT_OPEN");
    }
    if (message.includes("INVALID_CANDIDATE")) {
      return fail("Paslon tidak ditemukan di pemilihan ini.", "VALIDATION");
    }
    // Deliberately generic: never leak internals to the voter.
    return fail("Suara gagal dikirim. Coba lagi sebentar.", "UNKNOWN");
  }

  // Burn the session and clear the cookie so the device is clean for the
  // next person (critical in kiosk mode).
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    const sessionHash = await hashSessionToken(sessionToken);
    await supabase
      .from("vote_sessions")
      .update({ used: true })
      .eq("session_token_hash", sessionHash);
  }
  cookieStore.delete(SESSION_COOKIE);

  return ok({ receipt: formatReceipt(voteHash) });
}

// ---------------------------------------------------------------------
// clearBoothSession — kiosk auto-reset
// ---------------------------------------------------------------------
export async function clearBoothSession(): Promise<ActionResult> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return ok(undefined);
}

// ---------------------------------------------------------------------
// verifyReceipt — public "is my vote recorded?" check
// Returns ONLY whether it exists. Never the choice.
// ---------------------------------------------------------------------
export async function verifyReceipt(
  input: z.input<typeof verifyReceiptSchema>,
): Promise<ActionResult<{ recorded: boolean; electionTitle?: string; recordedAt?: string }>> {
  const parsed = verifyReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Kode bukti tidak valid.", "VALIDATION", "receipt");
  }

  const prefix = parsed.data.receipt
    .toUpperCase()
    .replace(/^AYP-/, "")
    .replace(/[^A-F0-9]/g, "");

  if (prefix.length < 12) {
    return fail(
      "Kode bukti kurang lengkap. Formatnya AYP-XXXX-XXXX-XXXX.",
      "VALIDATION",
      "receipt",
    );
  }

  const supabase = createAdminClient();

  // Match on the receipt prefix only, and never select candidate_id.
  const { data } = await supabase
    .from("votes")
    .select("created_at, election_id")
    .ilike("vote_hash", `${prefix.toLowerCase()}%`)
    .limit(2);

  if (!data || data.length !== 1) {
    return ok({ recorded: false });
  }

  const { data: election } = await supabase
    .from("elections")
    .select("title")
    .eq("id", data[0].election_id)
    .single();

  return ok({
    recorded: true,
    electionTitle: election?.title,
    recordedAt: data[0].created_at,
  });
}
