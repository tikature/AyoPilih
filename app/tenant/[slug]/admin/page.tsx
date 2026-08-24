import { adminElections, adminElection } from "@/lib/routes";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LIMITS, quotaPercentage } from "@/lib/plans";
import { formatDateTimeID } from "@/lib/utils";
import type { PlanType } from "@/types";

export default async function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data: tenant } = await supabase.from("tenants").select("id, name, plan").eq("slug", slug).single();

  if (!tenant) return null;

  const { data: tenantElections } = await supabase
    .from("elections")
    .select("id")
    .eq("tenant_id", tenant.id);
  const electionIds = (tenantElections ?? []).map((election) => election.id);

  const [{ count: activeElectionCount }, { count: totalVoterCount }, { data: elections }] = await Promise.all([
    supabase
      .from("elections")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .in("status", ["DRAFT", "SCHEDULED", "ONGOING"]),
    electionIds.length > 0
      ? supabase.from("voters").select("id", { count: "exact", head: true }).in("election_id", electionIds)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("elections")
      .select("id, title, status, start_time, end_time")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const plan = tenant.plan as PlanType;
  const limits = PLAN_LIMITS[plan];
  const quotaUsage = quotaPercentage(plan, totalVoterCount ?? 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Dashboard {tenant.name}</p>
          <h1 className="font-display text-3xl font-bold">Ringkasan Admin</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={adminElections()}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Kelola Pemilihan
          </Link>
        </div>
      </div>

      {quotaUsage >= 80 && (
        <div className="rounded-3xl border border-warning bg-background p-4 text-sm">
          <p className="font-semibold text-warning">⚠️ Kuota pemilih sudah {quotaUsage}%</p>
          <p className="mt-1 text-muted-foreground">
            Paket {limits.label} menampung {limits.maxVoters} pemilih. Naik ke paket yang lebih besar untuk menambah kapasitas.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Stat
          title="Pemilihan Aktif"
          value={activeElectionCount ?? 0}
          detail={`Maks: ${limits.maxActiveElections}`}
        />
        <Stat
          title="Total Pemilih"
          value={totalVoterCount ?? 0}
          detail={`Kuota: ${limits.maxVoters === Infinity ? "∞" : limits.maxVoters}`}
        />
        <Stat title="Paket" value={limits.label} detail={limits.price} />
        <Stat
          title="Kuota"
          value={`${quotaUsage}%`}
          detail={quotaUsage >= 100 ? "Penuh, upgrade sekarang" : `${limits.maxVoters === Infinity ? "∞" : Math.max(0, limits.maxVoters - (totalVoterCount ?? 0))} tersisa`}
        />
      </div>

      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl font-bold">Pemilihan terbaru</h2>
        <div className="mt-5 grid gap-3">
          {(elections ?? []).length === 0 ? (
            <p className="text-muted-foreground">Belum ada pemilihan. Buat pemilihan pertama untuk memulai.</p>
          ) : (
            elections?.map((election) => (
              <Link
                key={election.id}
                href={adminElection(election.id)}
                className="rounded-2xl border border-border bg-background p-4 hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{election.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTimeID(election.start_time)}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                    {election.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  title,
  value,
  detail,
}: {
  title: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-3 font-display text-3xl font-bold">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
