"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, type ActionResult } from "@/types";
import { requireTenantAccess, logAudit } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const updateProfileSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().min(2, "Nama minimal 2 karakter.").max(100),
});

const updateEmailSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email("Format email tidak valid."),
  password: z.string().min(1, "Kata sandi wajib diisi untuk verifikasi."),
});

const updatePasswordSchema = z.object({
  userId: z.string().uuid(),
  currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi."),
  newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter."),
});

const revokeSessionsSchema = z.object({
  userId: z.string().uuid(),
});

export async function updateDisplayName(
  input: z.input<typeof updateProfileSchema>,
): Promise<ActionResult<{ displayName: string }>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== parsed.data.userId) {
    return fail("Tidak diizinkan.", "FORBIDDEN");
  }

  const { error } = await supabase.auth.updateUser({
    data: { full_name: parsed.data.displayName },
  });

  if (error) {
    return fail("Gagal memperbarui nama.", "UNKNOWN");
  }

  await logAudit({
    tenantId: null,
    action: "USER_DISPLAY_NAME_UPDATED",
    meta: { displayName: parsed.data.displayName },
  });

  revalidatePath("/admin/pengaturan");
  return ok({ displayName: parsed.data.displayName });
}

export async function updateEmail(
  input: z.input<typeof updateEmailSchema>,
): Promise<ActionResult<void>> {
  const parsed = updateEmailSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== parsed.data.userId) {
    return fail("Tidak diizinkan.", "FORBIDDEN");
  }

  // Verify current password
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: parsed.data.password,
  });

  if (verifyError) {
    return fail("Kata sandi saat ini tidak cocok.", "UNAUTHORIZED");
  }

  const { error } = await supabase.auth.updateUser({
    email: parsed.data.email,
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return fail("Email sudah terdaftar. Gunakan email lain.", "VALIDATION");
    }
    return fail("Gagal memperbarui email.", "UNKNOWN");
  }

  await logAudit({
    tenantId: null,
    action: "USER_EMAIL_UPDATED",
    meta: { newEmail: parsed.data.email },
  });

  revalidatePath("/admin/pengaturan");
  return ok(undefined);
}

export async function updatePassword(
  input: z.input<typeof updatePasswordSchema>,
): Promise<ActionResult<void>> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== parsed.data.userId) {
    return fail("Tidak diizinkan.", "FORBIDDEN");
  }

  // Verify current password
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: parsed.data.currentPassword,
  });

  if (verifyError) {
    return fail("Kata sandi saat ini tidak cocok.", "UNAUTHORIZED");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (error) {
    return fail("Gagal memperbarui kata sandi.", "UNKNOWN");
  }

  await logAudit({
    tenantId: null,
    action: "USER_PASSWORD_UPDATED",
    meta: {},
  });

  revalidatePath("/admin/pengaturan");
  return ok(undefined);
}

export async function revokeAllSessions(
  input: z.input<typeof revokeSessionsSchema>,
): Promise<ActionResult<void>> {
  const parsed = revokeSessionsSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== parsed.data.userId) {
    return fail("Tidak diizinkan.", "FORBIDDEN");
  }

  const { error } = await supabase.auth.admin.signOut(parsed.data.userId);

  if (error) {
    return fail("Gagal keluar dari semua perangkat.", "UNKNOWN");
  }

  await logAudit({
    tenantId: null,
    action: "USER_SESSIONS_REVOKED",
    meta: {},
  });

  // Also revoke local session by redirecting to login
  return ok(undefined);
}

// Favicon upload
const updateFaviconSchema = z.object({
  tenantId: z.string().uuid(),
  faviconUrl: z.string().url().optional().or(z.literal("")),
});

export async function updateTenantFavicon(
  input: z.input<typeof updateFaviconSchema>,
): Promise<ActionResult<{ faviconUrl: string | null }>> {
  const parsed = updateFaviconSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const access = await requireTenantAccess(parsed.data.tenantId);
  if (!access.ok) return access;

  const supabase = createAdminClient();

  const { data: updated, error } = await supabase
    .from("tenants")
    .update({ favicon_url: parsed.data.faviconUrl || null })
    .eq("id", parsed.data.tenantId)
    .select()
    .single();

  if (error) {
    return fail("Gagal memperbarui favicon.", "UNKNOWN");
  }

  await logAudit({
    tenantId: parsed.data.tenantId,
    action: "TENANT_FAVICON_UPDATED",
    meta: { faviconUrl: parsed.data.faviconUrl || null },
  });

  revalidatePath("/admin/pengaturan");
  return ok({ faviconUrl: updated.favicon_url });
}