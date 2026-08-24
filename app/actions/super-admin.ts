"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/auth";
import { ok, fail, type ActionResult, type PlanType } from "@/types";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { revalidatePath } from "next/cache";

const updatePlanSchema = z.object({
  tenantId: z.string().uuid(),
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
  note: z.string().min(5, "Catatan wajib diisi (min. 5 karakter, mis. nomor invoice)."),
  validUntil: z.string().min(1, "Tanggal berlaku wajib diisi."),
});

export async function updateTenantPlan(
  input: z.input<typeof updatePlanSchema>,
): Promise<ActionResult<{ tenantId: string; plan: PlanType }>> {
  await requirePlatformAdmin();
  const admin = await requirePlatformAdmin(); // re-fetch email for audit

  const parsed = updatePlanSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const supabase = createAdminClient();
  const { data: current } = await supabase
    .from("tenants")
    .select("id, plan")
    .eq("id", parsed.data.tenantId)
    .maybeSingle();

  if (!current) {
    return fail("Tenant tidak ditemukan.", "NOT_FOUND");
  }

  if (current.plan === parsed.data.plan) {
    return fail("Paket tenant sudah sama.", "VALIDATION");
  }

  const { error } = await supabase
    .from("tenants")
    .update({ plan: parsed.data.plan })
    .eq("id", parsed.data.tenantId);

  if (error) {
    return fail("Gagal memperbarui paket tenant.", "UNKNOWN");
  }

  await logAudit({
    tenantId: parsed.data.tenantId,
    action: "TENANT_PLAN_UPDATED",
    meta: {
      actor: admin.email,
      from: current.plan,
      to: parsed.data.plan,
      note: parsed.data.note,
      validUntil: parsed.data.validUntil,
    },
  });

  revalidatePath("/internal");
  return ok({ tenantId: parsed.data.tenantId, plan: parsed.data.plan });
}

const freezeSchema = z.object({
  tenantId: z.string().uuid(),
  reason: z.string().min(5, "Alasan pembekuan wajib diisi (min. 5 karakter)."),
});

export async function freezeTenant(
  input: z.input<typeof freezeSchema>,
): Promise<ActionResult<void>> {
  await requirePlatformAdmin();
  const admin = await requirePlatformAdmin();

  const parsed = freezeSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, is_active")
    .eq("id", parsed.data.tenantId)
    .maybeSingle();

  if (!tenant) return fail("Tenant tidak ditemukan.", "NOT_FOUND");

  if (!tenant.is_active) {
    return fail("Tenant sudah dalam status nonaktif.", "VALIDATION");
  }

  const { error } = await supabase
    .from("tenants")
    .update({ is_active: false })
    .eq("id", parsed.data.tenantId);

  if (error) {
    return fail("Gagal membekukan tenant.", "UNKNOWN");
  }

  await logAudit({
    tenantId: parsed.data.tenantId,
    action: "TENANT_FROZEN",
    meta: { actor: admin.email, tenantName: tenant.name, reason: parsed.data.reason },
  });

  revalidatePath("/internal");
  return ok(undefined);
}

export async function unfreezeTenant(
  tenantId: string,
): Promise<ActionResult<void>> {
  await requirePlatformAdmin();
  const admin = await requirePlatformAdmin();

  if (!z.string().uuid().safeParse(tenantId).success) {
    return fail("TenantId tidak valid.", "VALIDATION");
  }

  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, is_active")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return fail("Tenant tidak ditemukan.", "NOT_FOUND");

  if (tenant.is_active) {
    return fail("Tenant sudah dalam status aktif.", "VALIDATION");
  }

  const { error } = await supabase
    .from("tenants")
    .update({ is_active: true })
    .eq("id", tenantId);

  if (error) {
    return fail("Gagal mengaktifkan tenant.", "UNKNOWN");
  }

  await logAudit({
    tenantId,
    action: "TENANT_UNFROZEN",
    meta: { actor: admin.email, tenantName: tenant.name },
  });

  revalidatePath("/internal");
  return ok(undefined);
}

export async function updateTenantPlanForm(
  tenantId: string,
  formData: FormData,
): Promise<void> {
  await requirePlatformAdmin();
  const admin = await requirePlatformAdmin();

  const plan = formData.get("plan") as PlanType;
  const note = formData.get("note") as string;
  const validUntil = formData.get("validUntil") as string;

  const supabase = createAdminClient();
  const { data: current } = await supabase
    .from("tenants")
    .select("id, plan")
    .eq("id", tenantId)
    .maybeSingle();

  if (!current) {
    throw new Error("Tenant tidak ditemukan.");
  }

  if (current.plan === plan) {
    throw new Error("Paket tenant sudah sama.");
  }

  if (!note || note.length < 5) {
    throw new Error("Catatan wajib diisi (min. 5 karakter, mis. nomor invoice).");
  }

  if (!validUntil) {
    throw new Error("Tanggal berlaku wajib diisi.");
  }

  const { error } = await supabase
    .from("tenants")
    .update({ plan })
    .eq("id", tenantId);

  if (error) {
    throw new Error("Gagal memperbarui paket tenant.");
  }

  await logAudit({
    tenantId,
    action: "TENANT_PLAN_UPDATED",
    meta: {
      actor: admin.email,
      from: current.plan,
      to: plan,
      note,
      validUntil,
    },
  });

  revalidatePath("/internal");
}

export async function freezeTenantForm(
  tenantId: string,
): Promise<void> {
  await requirePlatformAdmin();
  const admin = await requirePlatformAdmin();

  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, is_active")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) throw new Error("Tenant tidak ditemukan.");
  if (!tenant.is_active) throw new Error("Tenant sudah nonaktif.");

  const { error } = await supabase
    .from("tenants")
    .update({ is_active: false })
    .eq("id", tenantId);

  if (error) throw new Error("Gagal membekukan tenant.");

  await logAudit({
    tenantId,
    action: "TENANT_FROZEN",
    meta: { actor: admin.email, tenantName: tenant.name, reason: "Dibekukan oleh super admin." },
  });

  revalidatePath("/internal");
}

export async function unfreezeTenantForm(
  tenantId: string,
): Promise<void> {
  await requirePlatformAdmin();
  const admin = await requirePlatformAdmin();

  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, is_active")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) throw new Error("Tenant tidak ditemukan.");
  if (tenant.is_active) throw new Error("Tenant sudah aktif.");

  const { error } = await supabase
    .from("tenants")
    .update({ is_active: true })
    .eq("id", tenantId);

  if (error) throw new Error("Gagal mengaktifkan tenant.");

  await logAudit({
    tenantId,
    action: "TENANT_UNFROZEN",
    meta: { actor: admin.email, tenantName: tenant.name },
  });

  revalidatePath("/internal");
}