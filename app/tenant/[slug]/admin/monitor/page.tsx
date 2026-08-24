import { notFound } from "next/navigation";
import Link from "next/link";
import { BarChart3, Monitor } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { formatDateTimeID } from "@/lib/utils";
import { electionKiosk } from "@/lib/routes";
import type { CandidatePhoto, VelocityBucket } from "@/types";
import { MonitorClient } from "./monitor-client";

export default async function MonitorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ election?: string }>;
}) {
  const [{ slug }, { election: electionId }] = await Promise.all([params, searchParams]);
  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) notFound();

  const access = await requireTenantAccess(tenant.id);
  if (!access.ok) notFound();

  // Mode 1: tampilkan monitor pemilihan (jika ?election= disetor)
  if (electionId) {
    const { data: election } = await supabase
      .from("elections")
      .select("id, title, slug, voting_mode, status, start_time, end_time, show_public_result")
      .eq("id", electionId)
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    if (!election) notFound();

    const initialData = await getInitialMonitorData(electionId);

    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href={`/admin/pemilihan/${election.id}`} className="text-sm text-muted-foreground hover:underline">
              ← Kembali ke detail pemilihan
            </Link>
            <h1 className="mt-2 font-display text-3xl font-bold">Monitor Pemilihan</h1>
            <p className="mt-3 text-muted-foreground">{election.title}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/admin/tampilan?election=${election.id}`} className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 font-semibold hover:bg-muted">
              Atur Tampilan
            </Link>
            {election.voting_mode !== "ONLINE_ONLY" && (
              <a
                href={electionKiosk(election.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 font-semibold text-background hover:bg-foreground/90"
              >
                <Monitor className="h-4 w-4" />
                Buka Mode Kios
              </a>
            )}
          </div>
        </div>

        <MonitorClient
          electionId={election.id}
          electionStatus={election.status}
          initialData={initialData}
        />
      </div>
    );
  }

  // Mode 2: daftar pemilihan (jika tidak ada query ?election=)
  const { data: elections } = await supabase
    .from("elections")
    .select("id, title, slug, status, start_time, end_time, voting_mode")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  const list = elections ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Monitor Pemilihan</h1>
        <p className="mt-3 text-muted-foreground">
          Pilih pemilihan yang ingin dipantau perolehan suaranya secara realtime.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          Belum ada pemilihan. Buat pemilihan terlebih dahulu di menu
          <span className="font-semibold"> Kelola Pemilihan</span>.
        </div>
      ) : (
        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-bold">Daftar Pemilihan</h2>
          <div className="mt-5 grid gap-3">
            {list.map((election) => (
              <Link
                key={election.id}
                href={`/admin/monitor?election=${election.id}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4 hover:border-primary/40"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BarChart3 className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold">{election.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTimeID(election.start_time)} — {formatDateTimeID(election.end_time)}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    election.status === "ONGOING"
                      ? "bg-success/10 text-success"
                      : election.status === "CLOSED"
                        ? "bg-muted text-muted-foreground"
                        : election.status === "SCHEDULED"
                          ? "bg-info/10 text-info"
                          : "bg-secondary"
                  }`}
                >
                  {election.status}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function getInitialMonitorData(electionId: string) {
  const supabase = createAdminClient();

  const [
    { data: liveCountData },
    { data: turnoutData },
    { data: velocityData },
    { data: candidatesData },
  ] = await Promise.all([
    supabase.rpc("get_live_count", { p_election_id: electionId }),
    supabase.rpc("get_turnout", { p_election_id: electionId }),
    supabase.rpc("get_vote_velocity", {
      p_election_id: electionId,
      p_bucket_minutes: 5,
      p_window_minutes: 120,
    }),
    supabase
      .from("candidates")
      .select("id, candidate_number, photo_url")
      .eq("election_id", electionId),
  ]);

  const turnoutRow = (turnoutData ?? [])[0] as
    | { total_voters: number; voted: number }
    | undefined;

  const photos: CandidatePhoto[] = (candidatesData ?? []) as CandidatePhoto[];

  return {
    liveCount: (liveCountData ?? []) as {
      candidate_id: string;
      candidate_number: number;
      name: string;
      total: number;
    }[],
    turnout: {
      total_voters: turnoutRow?.total_voters ?? 0,
      voted: turnoutRow?.voted ?? 0,
      percentage:
        turnoutRow && turnoutRow.total_voters > 0
          ? Math.round((turnoutRow.voted / turnoutRow.total_voters) * 10000) / 100
          : 0,
    },
    velocity: (velocityData ?? []) as VelocityBucket[],
    candidatePhotos: photos,
  };
}