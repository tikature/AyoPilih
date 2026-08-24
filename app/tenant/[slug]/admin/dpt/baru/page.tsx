import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { VoterForm } from "../voter-form";

export default async function NewVoterPage({
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
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href={`/admin/dpt?election=${election.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Kembali ke DPT
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Tambah Pemilih</h1>
        <p className="mt-3 text-muted-foreground">{election.title}</p>
      </div>
      <VoterForm electionId={election.id} />
    </div>
  );
}
