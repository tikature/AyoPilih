import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeID } from "@/lib/utils";

const DB_FREE_LIMIT_MB = 500;
const STORAGE_FREE_LIMIT_MB = 1024;
const IDLE_DAYS_WARNING = 7;

export default async function InternalHealthPage() {
  const adminSupabase = createAdminClient();
  const supabase = await createClient();

  const [{ count: totalTenants }, { count: totalVotes }] = await Promise.all([
    supabase.from("tenants").select("id", { count: "exact", head: true }),
    supabase.from("votes").select("id", { count: "exact", head: true }),
  ]);

  // Get Supabase project health via admin API (approximation using pg_database_size)
  const { data: dbSize } = await adminSupabase.rpc("pg_database_size");
  const dbSizeMB = dbSize ? Math.round(dbSize / 1024 / 1024) : 0;

  // Storage size - we'll approximate by listing bucket sizes
  const { data: buckets } = await adminSupabase.storage.listBuckets();
  let totalStorageMB = 0;
  if (buckets) {
    for (const bucket of buckets) {
      if (["tenant-logos", "candidate-photos", "election-banners"].includes(bucket.id)) {
        const { data: files } = await adminSupabase.storage.from(bucket.id).list("", { limit: 1000 });
        if (files) {
          for (const file of files) {
            if (file.metadata?.size) {
              totalStorageMB += file.metadata.size;
            }
          }
        }
      }
    }
    totalStorageMB = Math.round(totalStorageMB / 1024 / 1024);
  }

  // Check for idle projects (no elections updated in 7 days)
  const cutoffDate = new Date(Date.now() - IDLE_DAYS_WARNING * 24 * 60 * 60 * 1000).toISOString();
  const { data: idleElections } = await supabase
    .from("elections")
    .select("id, title, tenant:tenants(name, slug), updated_at")
    .lt("updated_at", cutoffDate)
    .not("status", "in", "('CLOSED', 'ARCHIVED')")
    .order("updated_at", { ascending: true })
    .limit(10);

  const dbUsagePercent = Math.round((dbSizeMB / DB_FREE_LIMIT_MB) * 100);
  const storageUsagePercent = Math.round((totalStorageMB / STORAGE_FREE_LIMIT_MB) * 100);

  return (
    <main className="min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <Link href="/internal" className="text-sm text-muted-foreground hover:underline">
            ← Kembali ke Dashboard
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold">Kesehatan Sistem</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pemakaian resource Supabase & status proyek
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <h2 className="font-display text-xl font-bold">Supabase Resource Usage</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <UsageCard
              title="Database"
              used={dbSizeMB}
              limit={DB_FREE_LIMIT_MB}
              unit="MB"
              percent={dbUsagePercent}
              warning={dbUsagePercent >= 80}
            />
            <UsageCard
              title="Storage"
              used={totalStorageMB}
              limit={STORAGE_FREE_LIMIT_MB}
              unit="MB"
              percent={storageUsagePercent}
              warning={storageUsagePercent >= 80}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <h2 className="font-display text-xl font-bold">Statistik Global</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard title="Total Tenant" value={totalTenants ?? 0} />
            <StatCard title="Total Suara" value={totalVotes ?? 0} />
            <StatCard title="Proyek Idle" value={idleElections?.length ?? 0} detail={`${IDLE_DAYS_WARNING} hari tidak aktif`} />
          </div>
        </section>

        {idleElections && idleElections.length > 0 && (
          <section className="rounded-2xl border border-warning bg-warning/10 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-warning">⚠️</span>
              <h2 className="font-display text-xl font-bold text-warning">Proyek Mendekati Idle</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Proyek Supabase gratis akan dijeda otomatis setelah <strong>{IDLE_DAYS_WARNING} hari</strong> tanpa aktivitas database.
              Pemilihan berikut belum memiliki aktivitas &gt; {IDLE_DAYS_WARNING} hari:
            </p>
            <ul className="space-y-2">
              {idleElections.map((e) => {
                const tenant = Array.isArray(e.tenant) ? e.tenant[0] : e.tenant;
                return (
                  <li key={e.id} className="rounded-xl border border-border bg-background p-3 text-sm">
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-muted-foreground text-xs">
                      Tenant: {tenant?.name ?? "—"} ({tenant?.slug ?? "—"}) —
                      Terakhir update: {formatDateTimeID(e.updated_at)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function UsageCard({
  title,
  used,
  limit,
  unit,
  percent,
  warning,
}: {
  title: string;
  used: number;
  limit: number;
  unit: string;
  percent: number;
  warning: boolean;
}) {
  return (
    <div className={`rounded-xl border border-border bg-background p-6 ${warning ? "border-warning" : ""}`}>
      <div className="flex justify-between">
        <p className="font-semibold">{title}</p>
        <span className={warning ? "text-warning" : "text-muted-foreground"}>
          {percent}%
        </span>
      </div>
      <div className="mt-3 h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${warning ? "bg-warning" : "bg-primary"}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {used.toLocaleString()} / {limit.toLocaleString()} {unit}
      </p>
    </div>
  );
}

function StatCard({ title, value, detail }: { title: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-sm text-muted_foreground">{title}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}