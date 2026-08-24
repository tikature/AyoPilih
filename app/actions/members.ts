"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, type ActionResult } from "@/types";
import { requireTenantAccess, requireWriteRole, logAudit } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/plans";
import { revalidatePath } from "next/cache";

const inviteSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email("Format email tidak valid."),
  role: z.enum(["ADMIN", "VIEWER"]),
});

export async function inviteMember(
  input: z.input<typeof inviteSchema>,
): Promise<ActionResult<{ memberId: string }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const access = await requireTenantAccess(parsed.data.tenantId);
  if (!access.ok) return access;

  const writeCheck = requireWriteRole(access.data.role);
  if (!writeCheck.ok) return writeCheck;

  const supabase = createAdminClient();

  // Cek apakah email sudah punya akun Supabase Auth
  const { data: userList } = await supabase.auth.admin.listUsers();
  const targetUser = userList.users.find((u) => u.email?.toLowerCase() === parsed.data.email.toLowerCase());

  if (!targetUser) {
    return fail("Email belum terdaftar di sistem. Minta calon anggota daftar dulu di /daftar.", "VALIDATION", "email");
  }

  // Cek apakah sudah anggota tenant ini
  const { data: existing } = await supabase
    .from("tenant_members")
    .select("id")
    .eq("tenant_id", parsed.data.tenantId)
    .eq("user_id", targetUser.id)
    .maybeSingle();

  if (existing) {
    return fail("Email ini sudah menjadi anggota tenant ini.", "VALIDATION", "email");
  }

  // Cek batas maxMembers per paket
  const { count: currentMembers } = await supabase
    .from("tenant_members")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", parsed.data.tenantId);

  const limit = PLAN_LIMITS[access.data.tenant.plan].maxMembers;
  if (currentMembers && currentMembers >= limit) {
    return fail(
      `Paket ${PLAN_LIMITS[access.data.tenant.plan].label} maksimal ${limit} anggota panitia. Naik paket untuk menambah.`,
      "PLAN_LIMIT",
    );
  }

  const { data: member, error } = await supabase
    .from("tenant_members")
    .insert({
      tenant_id: parsed.data.tenantId,
      user_id: targetUser.id,
      role: parsed.data.role,
    })
    .select()
    .single();

  if (error) {
    return fail("Gagal menambah anggota.", "UNKNOWN");
  }

  await logAudit({
    tenantId: parsed.data.tenantId,
    action: "MEMBER_INVITED",
    meta: { memberId: member.id, email: parsed.data.email, role: parsed.data.role, invitedBy: access.data.userId },
  });

  revalidatePath("/admin/pengaturan");
  return ok({ memberId: member.id });
}

const updateRoleSchema = z.object({
  tenantId: z.string().uuid(),
  memberId: z.string().uuid(),
  role: z.enum(["ADMIN", "VIEWER"]),
});

export async function updateMemberRole(
  input: z.input<typeof updateRoleSchema>,
): Promise<ActionResult<void>> {
  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const access = await requireTenantAccess(parsed.data.tenantId);
  if (!access.ok) return access;

  const writeCheck = requireWriteRole(access.data.role);
  if (!writeCheck.ok) return writeCheck;

  // OWNER tidak bisa diubah rolenya via UI (hanya satu OWNER per tenant)
  const supabase = createAdminClient();
  const { data: targetMember } = await supabase
    .from("tenant_members")
    .select("role, user_id")
    .eq("id", parsed.data.memberId)
    .eq("tenant_id", parsed.data.tenantId)
    .maybeSingle();

  if (!targetMember) return fail("Anggota tidak ditemukan.", "NOT_FOUND");
  if (targetMember.role === "OWNER") return fail("Peran OWNER tidak bisa diubah.", "FORBIDDEN");

  // Hanya OWNER yang bisa menurunkan/mengangkat ADMIN
  if (parsed.data.role === "ADMIN" && access.data.role !== "OWNER") {
    return fail("Hanya OWNER yang bisa mengangkat ke ADMIN.", "FORBIDDEN");
  }

  const { error } = await supabase
    .from("tenant_members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.memberId);

  if (error) return fail("Gagal mengubah peran.", "UNKNOWN");

  await logAudit({
    tenantId: parsed.data.tenantId,
    action: "MEMBER_ROLE_UPDATED",
    meta: { memberId: parsed.data.memberId, newRole: parsed.data.role, updatedBy: access.data.userId },
  });

  revalidatePath("/admin/pengaturan");
  return ok(undefined);
}

const removeMemberSchema = z.object({
  tenantId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export async function removeMember(
  input: z.input<typeof removeMemberSchema>,
): Promise<ActionResult<void>> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const access = await requireTenantAccess(parsed.data.tenantId);
  if (!access.ok) return access;

  const writeCheck = requireWriteRole(access.data.role);
  if (!writeCheck.ok) return writeCheck;

  const supabase = createAdminClient();
  const { data: targetMember } = await supabase
    .from("tenant_members")
    .select("role, user_id")
    .eq("id", parsed.data.memberId)
    .eq("tenant_id", parsed.data.tenantId)
    .maybeSingle();

  if (!targetMember) return fail("Anggota tidak ditemukan.", "NOT_FOUND");
  if (targetMember.role === "OWNER") return fail("OWNER tidak bisa dihapus.", "FORBIDDEN");
  if (targetMember.user_id === access.data.userId) return fail("Tidak bisa menghapus diri sendiri.", "FORBIDDEN");

  // Hanya OWNER yang bisa menghapus ADMIN
  if (targetMember.role === "ADMIN" && access.data.role !== "OWNER") {
    return fail("Hanya OWNER yang bisa menghapus ADMIN.", "FORBIDDEN");
  }

  const { error } = await supabase
    .from("tenant_members")
    .delete()
    .eq("id", parsed.data.memberId);

  if (error) return fail("Gagal menghapus anggota.", "UNKNOWN");

  await logAudit({
    tenantId: parsed.data.tenantId,
    action: "MEMBER_REMOVED",
    meta: { memberId: parsed.data.memberId, removedBy: access.data.userId, removedRole: targetMember.role },
  });

  revalidatePath("/admin/pengaturan");
  return ok(undefined);
}