import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/auth";

export interface PlatformAdminContext {
  userId: string;
  email: string;
}

/**
 * Ensures the logged in user is a platform admin (super admin).
 * Returns email and userId, otherwise triggers notFound() (404) to mask page existence.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    notFound();
  }

  // Bypass RLS to check platform_admins
  const adminClient = createAdminClient();
  const { data: admin } = await adminClient
    .from("platform_admins")
    .select("id, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!admin) {
    notFound();
  }

  // Record audit log
  await logAudit({
    tenantId: null,
    action: "SUPER_ADMIN_VISIT",
    meta: { email: user.email },
  });

  return { userId: user.id, email: user.email };
}