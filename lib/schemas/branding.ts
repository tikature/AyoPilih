import { z } from "zod";

export const timelineItemSchema = z.object({
  label: z.string().min(1, "Label tahapan wajib diisi.").max(60),
  start: z.string().min(1, "Tanggal mulai wajib diisi."),
  end: z.string().min(1, "Tanggal selesai wajib diisi."),
  description: z.string().max(200).optional(),
});

export const brandingSchema = z.object({
  electionId: z.string().uuid(),
  title: z.string().min(3, "Judul pemilihan minimal 3 karakter.").max(100),
  subtitle: z.string().max(200).optional().or(z.literal("")),
  description: z.string().max(5000).optional().or(z.literal("")),
  banner_url: z.string().url().optional().or(z.literal("")),
  timeline: z.array(timelineItemSchema).optional(),
  contact_info: z.string().max(300).optional().or(z.literal("")),
  show_candidates_before_login: z.boolean().default(true),
  show_public_result: z.boolean().default(false),
});

export type BrandingInput = z.input<typeof brandingSchema>;
