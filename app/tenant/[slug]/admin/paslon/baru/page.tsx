import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { CandidateForm } from "../candidate-form";

export default async function NewCandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ election?: string }>;
}) {
  const [{ slug }, { election: electionId }] = await Promise.all([params, searchParams]);
  if (!electionId) notFound();

  const supabase = createAdminClient();
  const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", slug).single();
  if (!tenant) notFound();

  const access = await requireTenantAccess(tenant.id);
  if (!access.ok) notFound();

  const { data: election } = await supabase
    .from("elections")
    .select("id, title, tenant_id")
    .eq("id", electionId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!election) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Tambah Paslon</h1>
        <p className="mt-3 text-muted-foreground">{election.title}</p>
      </div>
      <CandidateForm electionId={election.id} />
    </div>
  );
}
