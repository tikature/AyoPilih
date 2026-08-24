import { requirePlatformAdmin } from "@/lib/platform-auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { freezeTenantForm, unfreezeTenantForm } from "@/app/actions/super-admin";
import { PLAN_LIMITS } from "@/lib/plans";
import type { PlanType } from "@/types";
import { PlanChangeForm } from "./plan-change-form";

export default async function InternalTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    notFound();
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, plan, is_active, created_at, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!tenant) notFound();

  const [{ count: electionCount }, { data: elections }] = await Promise.all([
    supabase.from("elections").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    supabase.from("elections").select("id, title, status, start_time, end_time").eq("tenant_id", id).order("created_at", { ascending: false }).limit(10),
  ]);

  const tenantElectionIds = (elections ?? []).map((e) => e.id);
  let totalVoters = 0;
  if (tenantElectionIds.length > 0) {
    const { count } = await supabase
      .from("voters")
      .select("id", { count: "exact", head: true })
      .in("election_id", tenantElectionIds);
    totalVoters = count ?? 0;
  }

  return (
    <main className="min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <Link href="/internal/tenants" className="text-sm text-muted-foreground hover:underline">
            ← Kembali ke Daftar Tenant
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold">{tenant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tenant.slug}</p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <h2 className="font-display text-xl font-bold">Informasi Tenant</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard title="Paket" value={PLAN_LIMITS[tenant.plan as PlanType].label} />
            <StatCard title="Pemilihan" value={electionCount ?? 0} detail={`Maks: ${PLAN_LIMITS[tenant.plan as PlanType].maxActiveElections}`} />
            <StatCard title="Total DPT" value={totalVoters} detail={`Kuota: ${PLAN_LIMITS[tenant.plan as PlanType].maxVoters === Infinity ? "∞" : PLAN_LIMITS[tenant.plan as PlanType].maxVoters}`} />
            <StatCard title="Status" value={tenant.is_active ? "Aktif" : "Nonaktif"} detail={tenant.is_active ? "Tenant bisa diakses" : "Subdomain mengembalikan 404"} />
          </div>

          <hr className="border-border" />

          <h3 className="font-semibold">Ubah Paket</h3>
          <PlanChangeForm tenantId={tenant.id} currentPlan={tenant.plan} />

          <hr className="border-border" />

          <h3 className="font-semibold">Status Tenant</h3>
          {tenant.is_active ? (
            <form action={freezeTenantForm.bind(null, tenant.id)}>
              <button
                type="submit"
                className="h-11 rounded-full border border-destructive px-5 font-semibold text-destructive hover:bg-destructive hover:text-primary-foreground"
              >
                Bekukan Tenant
              </button>
            </form>
          ) : (
            <form action={unfreezeTenantForm.bind(null, tenant.id)}>
              <button
                type="submit"
                className="h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                Aktifkan Tenant
              </button>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-bold">Pemilihan Terbaru</h2>
          <div className="mt-4 space-y-3">
            {(elections ?? []).length === 0 ? (
              <p className="text-muted-foreground">Belum ada pemilihan.</p>
            ) : (
              elections?.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-background p-4"
                >
                  <div>
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.start_time).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                    {e.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ title, value, detail }: { title: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}