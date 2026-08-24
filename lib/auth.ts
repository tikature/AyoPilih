import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult, type Tenant, type MemberRole } from "@/types";

export interface AccessContext {
  userId: string;
  tenant: Tenant;
  role: MemberRole;
}

/**
 * Every Server Action that touches tenant data must call one of these first.
 * Never trust a tenant_id that came from the client without checking it here.
 */
export async function requireTenantAccess(
  tenantId: string,
): Promise<ActionResult<AccessContext>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("Silakan masuk terlebih dahulu.", "UNAUTHORIZED");
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role, tenant:tenants(*)")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !membership.tenant) {
    await logAudit({
      tenantId,
      action: "ACCESS_DENIED",
      meta: { userId: user.id },
    });
    return fail("Kamu tidak punya akses ke ruang ini.", "FORBIDDEN");
  }

  return ok({
    userId: user.id,
    tenant: membership.tenant as unknown as Tenant,
    role: membership.role as MemberRole,
  });
}

/** Same check, resolved through an election id. */
export async function requireElectionAccess(
  electionId: string,
): Promise<ActionResult<AccessContext & { electionId: string }>> {
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, tenant_id")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) {
    return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");
  }

  const access = await requireTenantAccess(election.tenant_id);
  if (!access.ok) return access;

  return ok({ ...access.data, electionId });
}

/** Viewers can read but not change anything. */
export function requireWriteRole(role: MemberRole): ActionResult<void> {
  if (role === "VIEWER") {
    return fail("Peran Pemantau hanya bisa melihat, tidak bisa mengubah.", "FORBIDDEN");
  }
  return ok(undefined);
}

interface AuditInput {
  tenantId?: string | null;
  electionId?: string | null;
  action: string;
  meta?: Record<string, unknown>;
}

/**
 * Writes an audit entry. NEVER pass a voter id together with a candidate id,
 * and never pass a plaintext token. See SECURITY.md §12.
 */
export async function logAudit({
  tenantId = null,
  electionId = null,
  action,
  meta = {},
}: AuditInput): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("audit_logs").insert({
      tenant_id: tenantId,
      election_id: electionId,
      actor_id: user?.id ?? null,
      actor_label: user?.email ?? "sistem",
      action,
      meta,
    });
  } catch {
    // Auditing must never break the user-facing action.
  }
}
