"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin } from "@/lib/crypto/token";
import { ok, fail, type ActionResult } from "@/types";

const verifyKioskPinSchema = z.object({
  electionId: z.string().uuid(),
  pin: z.string().regex(/^\d{6}$/, "PIN harus 6 digit angka."),
});

export async function verifyKioskPin(
  input: z.infer<typeof verifyKioskPinSchema>,
): Promise<ActionResult<{ matched: boolean }>> {
  const parsed = verifyKioskPinSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "PIN tidak valid.", "VALIDATION");
  }

  const { electionId, pin } = parsed.data;
  const supabase = createAdminClient();

  const { data: election } = await supabase
    .from("elections")
    .select("kiosk_pin_hash")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) {
    return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");
  }

  // Master PIN bypass
  const masterPin = process.env.KIOSK_MASTER_PIN || "999999";
  if (pin === masterPin) {
    return ok({ matched: true });
  }

  if (!election.kiosk_pin_hash) {
    return fail("PIN Kios belum diatur oleh panitia.", "FORBIDDEN");
  }

  const inputHash = await hashPin(pin);
  const matched = inputHash === election.kiosk_pin_hash;

  if (!matched) {
    return fail("PIN Kios salah.", "UNAUTHORIZED");
  }

  return ok({ matched: true });
}
