import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { adminElection } from "@/lib/routes";
import { PLAN_LIMITS } from "@/lib/plans";
import type { PlanType } from "@/types";
import { LaporanClientPanel } from "./laporan-client";

export default async function ElectionReportPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, plan, name")
    .eq("slug", slug)
    .single();

  if (!tenant) notFound();

  const access = await requireTenantAccess(tenant.id);
  if (!access.ok) redirect("/masuk");

  const { data: election } = await supabase
    .from("elections")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!election) notFound();

  const [{ data: liveCount }, { data: turnout }] = await Promise.all([
    supabase.rpc("get_live_count", { p_election_id: id }),
    supabase.rpc("get_turnout", { p_election_id: id }),
  ]);

  const hasResend = !!process.env.RESEND_API_KEY;
  const hasFonnte = !!process.env.FONNTE_TOKEN;

  const plan = tenant.plan as PlanType;
  const limits = PLAN_LIMITS[plan];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link
          href={adminElection(id)}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Kembali ke Detail Pemilihan
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Laporan & Berita Acara</h1>
        <p className="mt-1 text-sm text-muted-foreground">{election.title}</p>
      </div>

      <LaporanClientPanel
        electionId={id}
        plan={plan}
        limits={limits}
        hasResend={hasResend}
        hasFonnte={hasFonnte}
        turnout={turnout?.[0] ?? { total_voters: 0, voted: 0 }}
        liveCount={liveCount ?? []}
      />
    </div>
  );
}
