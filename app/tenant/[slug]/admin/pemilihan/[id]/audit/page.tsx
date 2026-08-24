import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { adminElection } from "@/lib/routes";
import { AuditClientPanel } from "./audit-client";

export default async function ElectionAuditPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!tenant) notFound();

  const access = await requireTenantAccess(tenant.id);
  if (!access.ok) redirect("/masuk");

  const { data: election } = await supabase
    .from("elections")
    .select("title")
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!election) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <Link
          href={adminElection(id)}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Kembali ke Detail Pemilihan
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Log Audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">{election.title}</p>
      </div>

      <AuditClientPanel electionId={id} />
    </div>
  );
}