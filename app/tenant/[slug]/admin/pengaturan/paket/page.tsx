import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { PLAN_LIMITS, quotaPercentage } from "@/lib/plans";
import { adminSettings } from "@/lib/routes";
import type { PlanType } from "@/types";

export default async function PaketSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();

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

  const adminSupabase = createAdminClient();

  const { data: tenantElections } = await adminSupabase
    .from("elections")
    .select("id")
    .eq("tenant_id", tenant.id);
  const electionIds = (tenantElections ?? []).map((election) => election.id);

  const [{ count: activeElectionCount }, { count: totalVoterCount }] = await Promise.all([
    adminSupabase
      .from("elections")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .in("status", ["DRAFT", "SCHEDULED", "ONGOING"]),
    electionIds.length > 0
      ? adminSupabase.from("voters").select("id", { count: "exact", head: true }).in("election_id", electionIds)
      : Promise.resolve({ count: 0 }),
  ]);

  const plan = tenant.plan as PlanType;
  const limits = PLAN_LIMITS[plan];
  const quotaUsage = quotaPercentage(plan, totalVoterCount ?? 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link
          href={adminSettings()}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Kembali ke Pengaturan
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Paket & Langganan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola paket langganan dan pantau kuota pemakaian organisasi Anda.
        </p>
      </div>

      {/* Current Plan Card */}
      <section className="rounded-3xl border border-border bg-card p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Paket Saat Ini</p>
            <h2 className="font-display text-2xl font-bold">{limits.label}</h2>
          </div>
          <div className="rounded-full bg-primary/10 px-4 py-2 font-display text-sm font-semibold text-primary">
            {limits.price}
          </div>
        </div>

        <hr className="border-border" />

        {/* Usage Stats */}
        <div className="space-y-4">
          <h3 className="font-semibold">Pemakaian Kuota</h3>

          {/* Voters limit */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Pemilih Terdaftar</span>
              <span className="font-medium">
                {totalVoterCount ?? 0} / {limits.maxVoters === Infinity ? "∞" : limits.maxVoters}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full ${quotaUsage >= 100 ? "bg-destructive" : quotaUsage >= 80 ? "bg-warning" : "bg-primary"}`}
                style={{ width: `${Math.min(100, quotaUsage)}%` }}
              />
            </div>
            {quotaUsage >= 80 && (
              <p className="text-xs text-warning font-semibold">
                ⚠️ Kuota pemilih Anda mendekati batas maksimal paket.
              </p>
            )}
          </div>

          {/* Active elections limit */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-sm">
              <span>Pemilihan Aktif</span>
              <span className="font-medium">
                {activeElectionCount ?? 0} / {limits.maxActiveElections === Infinity ? "∞" : limits.maxActiveElections}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Upgrade Instructions */}
      <section className="rounded-3xl border border-border bg-card p-6 space-y-4">
        <h3 className="font-display text-xl font-bold">Cara Upgrade Paket</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Untuk melakukan upgrade ke paket <strong>Pro</strong> atau <strong>Enterprise</strong> dengan kapasitas pemilih yang lebih besar, fitur kustomisasi warna tema, kirim token otomatis via Email & WhatsApp, dan ekspor berita acara PDF berkop, silakan hubungi administrator AyoPilih melalui:
        </p>
        <div className="rounded-2xl border border-border bg-background p-4 space-y-2 text-sm">
          <p>📧 Email: <a href="mailto:support@ayopilih.id" className="text-primary hover:underline">support@ayopilih.id</a></p>
          <p>💬 WhatsApp: <span className="font-semibold">+62 812-3456-7890</span></p>
        </div>
        <p className="text-xs text-muted-foreground">
          Sertakan nama organisasi/tenant dan slug subdomain Anda (<strong>{tenant.slug}</strong>) saat mengajukan permohonan upgrade.
        </p>
      </section>
    </div>
  );
}