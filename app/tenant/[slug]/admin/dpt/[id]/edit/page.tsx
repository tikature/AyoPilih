import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { VoterForm } from "../../voter-form";
import type { Voter } from "@/types";

export default async function EditVoterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ election?: string }>;
}) {
  const [{ slug, id }, { election: electionId }] = await Promise.all([params, searchParams]);
  if (!electionId) notFound();

  const supabase = createAdminClient();
  const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", slug).single();
  if (!tenant) notFound();

  const access = await requireTenantAccess(tenant.id);
  if (!access.ok) notFound();

  const { data: voter } = await supabase
    .from("voters")
    .select("*, election:elections(id, title, tenant_id)")
    .eq("id", id)
    .maybeSingle();

  if (!voter || voter.election?.tenant_id !== tenant.id) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href={`/admin/dpt?election=${voter.election.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Kembali ke DPT
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Edit Pemilih</h1>
        <p className="mt-3 text-muted-foreground">{voter.election.title}</p>
      </div>
      <VoterForm electionId={voter.election.id} voter={voter as unknown as Voter} />
    </div>
  );
}
