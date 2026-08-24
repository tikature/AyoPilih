import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { adminSettings } from "@/lib/routes";
import { AccountSettings } from "./account-settings";
import { FaviconSettings } from "./favicon-settings";
import { MembersManager } from "./members-manager";
import type { Tenant, MemberRole, PlanType } from "@/types";
import { unstable_noStore } from "next/cache";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  unstable_noStore();
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) {
    redirect("/masuk");
  }

  const access = await requireTenantAccess(tenant.id);
  if (!access.ok) {
    redirect("/masuk");
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/masuk");
  }

  const adminSupabase = createAdminClient();
  const { data: userData } = await adminSupabase.auth.admin.getUserById(user.id);
  const currentEmail = userData?.user?.email ?? user.email ?? "";
  const displayName =
    (userData?.user?.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    "";

  // Fetch members - explicit select with proper join
  const { data: members } = await adminSupabase
    .from("tenant_members")
    .select("id, user_id, role, created_at, users(email)")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: true });

  const formattedMembers = ((members ?? []) as Array<{ id: string; user_id: string; role: string; created_at: string; users: { email: string }[] }>).map((m) => {
    const userEmail = Array.isArray(m.users) ? m.users[0]?.email : undefined;
    return {
      id: m.id,
      userId: m.user_id,
      email: userEmail ?? "",
      role: m.role as MemberRole,
      created_at: m.created_at,
    };
  });

  // Tentukan role: cek tenant.owner_id dulu (paling andal), baru cek members
  const currentUserRole =
    tenant.owner_id === user.id
      ? "OWNER"
      : (formattedMembers.find((m) => m.userId === user.id)?.role ?? "VIEWER");

  const tenantData = tenant as unknown as Tenant;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link
          href={adminSettings()}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Kembali ke Pengaturan
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atur akun panitia dan identitas subdomain {tenantData.name}.
        </p>
      </div>

      <AccountSettings
        userId={user.id}
        currentEmail={currentEmail}
        currentDisplayName={displayName}
      />

      <FaviconSettings
        tenantId={tenantData.id}
        currentFaviconUrl={tenantData.favicon_url ?? null}
      />

      <MembersManager
        tenantId={tenantData.id}
        currentUserRole={currentUserRole}
        plan={tenantData.plan as PlanType}
        members={formattedMembers}
        currentUserId={user.id}
      />
    </div>
  );
}