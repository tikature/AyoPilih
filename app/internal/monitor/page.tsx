import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeID } from "@/lib/utils";

export default async function InternalMonitorPage() {
  const supabase = await createClient();

  const { data: ongoingElections } = await supabase
    .from("elections")
    .select("id, title, start_time, end_time, tenant:tenants(name, slug)")
    .eq("status", "ONGOING")
    .order("start_time", { ascending: true });

  return (
    <main className="min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <Link href="/internal" className="text-sm text-muted-foreground hover:underline">
            ← Kembali ke Dashboard
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold">Monitor Pemilihan Berjalan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {(ongoingElections ?? []).length} pemilihan berstatus ONGOING
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {(ongoingElections ?? []).length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Tidak ada pemilihan berstatus ONGOING saat ini.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="p-4 text-left font-semibold">Tenant</th>
                  <th className="p-4 text-left font-semibold">Pemilihan</th>
                  <th className="p-4 text-left font-semibold">Jadwal</th>
                  <th className="p-4 text-left font-semibold">DPT</th>
                  <th className="p-4 text-left font-semibold">Partisipasi</th>
                </tr>
              </thead>
              <tbody>
                {ongoingElections?.map((e) => (
                  <ElectionRow key={e.id} election={e} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}

async function ElectionRow({
  election,
}: {
  election: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    tenant: { name: string; slug: string }[] | { name: string; slug: string } | null;
  };
}) {
  const supabase = await createClient();

  const [{ data: turnout }, { count: voterCount }] = await Promise.all([
    supabase.rpc("get_turnout", { p_election_id: election.id }),
    supabase.from("voters").select("id", { count: "exact", head: true }).eq("election_id", election.id),
  ]);

  const totalVoters = voterCount ?? 0;
  const voted = turnout?.[0]?.voted ?? 0;
  const percentage = totalVoters > 0 ? ((voted / totalVoters) * 100).toFixed(2) : "0.00";

  const tenant = Array.isArray(election.tenant) ? election.tenant[0] : election.tenant;
  const tenantName = tenant?.name ?? "—";
  const tenantSlug = tenant?.slug ?? "—";

  return (
    <tr className="border-b border-border/50 hover:bg-muted/50">
      <td className="p-4">
        <p className="font-semibold">{tenantName}</p>
        <p className="text-muted-foreground font-mono text-xs">{tenantSlug}</p>
      </td>
      <td className="p-4">
        <p className="font-semibold">{election.title}</p>
      </td>
      <td className="p-4 text-muted-foreground">
        {formatDateTimeID(election.start_time)} — {formatDateTimeID(election.end_time)}
      </td>
      <td className="p-4 font-mono">{totalVoters}</td>
      <td className="p-4">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {percentage}%
        </span>
        <p className="mt-1 text-xs text-muted-foreground">{voted} dari {totalVoters} pemilih</p>
      </td>
    </tr>
  );
}