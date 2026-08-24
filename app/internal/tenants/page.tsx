import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function InternalTenantsPage() {
  const supabase = await createClient();

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, plan, is_active, created_at")
    .order("created_at", { ascending: false });

  const tenantData = await Promise.all(
    (tenants ?? []).map(async (t) => {
      const [{ count: electionCount }, { data: electionIds }] = await Promise.all([
        supabase.from("elections").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        supabase.from("elections").select("id").eq("tenant_id", t.id),
      ]);

      const ids = (electionIds ?? []).map((e) => e.id);
      const { count: voterCount } = await supabase
        .from("voters")
        .select("id", { count: "exact", head: true })
        .in("election_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);

      return {
        ...t,
        electionCount: electionCount ?? 0,
        voterCount: voterCount ?? 0,
      };
    }));

  return (
    <main className="min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <Link href="/internal" className="text-sm text-muted-foreground hover:underline">
            ← Kembali ke Dashboard
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold">Daftar Tenant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tenantData.length} tenant terdaftar
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="p-4 text-left font-semibold">Nama / Slug</th>
                <th className="p-4 text-left font-semibold">Paket</th>
                <th className="p-4 text-left font-semibold">Pemilihan</th>
                <th className="p-4 text-left font-semibold">DPT</th>
                <th className="p-4 text-left font-semibold">Tanggal Daftar</th>
                <th className="p-4 text-left font-semibold">Status</th>
                <th className="p-4 text-left font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tenantData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Belum ada tenant terdaftar.
                  </td>
                </tr>
              ) : (
                tenantData.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="p-4">
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-muted-foreground font-mono text-xs">{t.slug}</p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        t.plan === "ENTERPRISE" ? "bg-primary/10 text-primary"
                        : t.plan === "PRO" ? "bg-info/10 text-info"
                        : "bg-secondary text-secondary-foreground"
                      }`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="p-4">{t.electionCount}</td>
                    <td className="p-4">{t.voterCount}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("id-ID", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </td>
                    <td className="p-4">
                      <span className={t.is_active ? "text-success" : "text-destructive"}>
                        {t.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/internal/tenants/${t.id}`}
                        className="inline-flex h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
                      >
                        Kelola
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}