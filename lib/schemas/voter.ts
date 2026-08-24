import { z } from "zod";

export const voterFormSchema = z.object({
  electionId: z.string().uuid(),
  identifier: z
    .string()
    .min(1, "Identitas (NISN/NIM/NIK) wajib diisi.")
    .max(32, "Identitas maksimal 32 karakter."),
  name: z.string().min(1, "Nama wajib diisi.").max(120, "Nama maksimal 120 karakter."),
  group_name: z.string().max(60, "Kelas/prodi maksimal 60 karakter.").optional(),
  email: z.string().email("Format email tidak valid.").optional().or(z.literal("")),
  phone: z.string().max(20, "Nomor HP maksimal 20 karakter.").optional().or(z.literal("")),
});

export type VoterFormInput = z.input<typeof voterFormSchema>;
