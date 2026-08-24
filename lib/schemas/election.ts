import { z } from "zod";

const TIME_ZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] as const;

export const electionSchema = z.object({
  title: z.string().min(3, "Judul pemilihan minimal 3 karakter.").max(100),
  slug: z
    .string()
    .min(2, "Slug minimal 2 karakter.")
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Hanya huruf kecil, angka, dan tanda hubung."),
  subtitle: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  voting_mode: z.enum(["ONLINE_ONLY", "OFFLINE_TPS", "HYBRID"]),
  start_time: z.string().min(1, "Waktu mulai wajib diisi."),
  end_time: z.string().min(1, "Waktu selesai wajib diisi."),
  time_zone: z.enum(TIME_ZONES).default("Asia/Jakarta"),
  allow_abstain: z.boolean().default(false),
  show_candidates_before_login: z.boolean().default(true),
  show_public_result: z.boolean().default(false),
  kiosk_pin: z.string().regex(/^\d{6}$/, "PIN Kios harus berisi 6 digit angka.").optional().or(z.literal("")),
});

export const candidateSchema = z.object({
  electionId: z.string().uuid(),
  candidate_number: z.coerce.number().int().min(1, "Nomor urut minimal 1."),
  name: z.string().min(2, "Nama ketua wajib diisi.").max(100),
  running_mate: z.string().max(100).optional(),
  short_bio: z.string().max(500).optional(),
  vision: z.string().max(3000).optional(),
  mission: z.string().max(3000).optional(),
  photo_url: z.string().url().optional().or(z.literal("")),
});
