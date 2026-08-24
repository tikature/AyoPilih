"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, type ActionResult, type Tenant } from "@/types";
import { requireTenantAccess, logAudit } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/plans";
import { revalidatePath } from "next/cache";

const updateBrandingSchema = z.object({
  tenantId: z.string().uuid(),
  theme_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Format warna harus #RRGGBB."),
  logo_url: z.string().url().optional().or(z.literal("")),
});

export async function updateTenantBranding(
  input: z.infer<typeof updateBrandingSchema>,
): Promise<ActionResult<Tenant>> {
  const parsed = updateBrandingSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const { tenantId, theme_color, logo_url } = parsed.data;

  const access = await requireTenantAccess(tenantId);
  if (!access.ok) return access;

  // Starter pack can't use custom themes (SAAS_BUSINESS_MODEL.md)
  const currentPlan = access.data.tenant.plan;
  const limits = PLAN_LIMITS[currentPlan];

  const supabase = createAdminClient();

  // any is required here because values can be string or null for logo_url
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  if (limits.customTheme) {
    updates.theme_color = theme_color;
  } else if (theme_color !== "#C81D1D") {
    return fail(`Paket ${limits.label} tidak mendukung kustomisasi warna tema.`, "PLAN_LIMIT");
  }

  updates.logo_url = logo_url || null;

  const { data: updated, error } = await supabase
    .from("tenants")
    .update(updates)
    .eq("id", tenantId)
    .select()
    .single();

  if (error) {
    return fail("Gagal memperbarui branding organisasi.", "UNKNOWN");
  }

  await logAudit({
    tenantId,
    action: "TENANT_BRANDING_UPDATED",
    meta: { theme_color: updates.theme_color, logo_url: updates.logo_url },
  });

  // Revalidate page for branding settings
  // Since updateTenantBranding doesn't take electionId, we revalidate the main layout / admin path
  revalidatePath("/admin", "layout");
  return ok(updated as unknown as Tenant);
}
