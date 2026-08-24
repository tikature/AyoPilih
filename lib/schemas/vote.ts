import { z } from "zod";
import { normalizeToken } from "@/lib/crypto/token";

export const verifyTokenSchema = z.object({
  electionId: z.string().uuid(),
  token: z
    .string()
    .trim()
    .min(1, "Token belum diisi.")
    .transform(normalizeToken),
});

export const submitVoteSchema = z.object({
  electionId: z.string().uuid(),
  candidateId: z.string().uuid().nullable(), // null = abstain / kotak kosong
});

export const verifyReceiptSchema = z.object({
  receipt: z.string().trim().min(8, "Kode bukti terlalu pendek."),
});
