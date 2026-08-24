import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { CandidateForm } from "../../candidate-form";
import type { Candidate } from "@/types";

export default async function EditCandidatePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const supabase = createAdminClient();
  const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", slug).single();
  if (!tenant) notFound();

  const access = await requireTenantAccess(tenant.id);
  if (!access.ok) notFound();

  const { data: candidate } = await supabase
    .from("candidates")
    .select("*, election:elections(id, title, tenant_id)")
    .eq("id", id)
    .maybeSingle();

  if (!candidate || candidate.election?.tenant_id !== tenant.id) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Edit Paslon</h1>
        <p className="mt-3 text-muted-foreground">{candidate.election.title}</p>
      </div>
      <CandidateForm electionId={candidate.election.id} candidate={candidate as unknown as Candidate} />
    </div>
  );
}
