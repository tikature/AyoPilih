import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { formatDateTimeID } from "@/lib/utils";
import { DeleteElectionButton, PublishElectionButton, CloseElectionButton } from "./election-actions";
import { adminElections, adminBranding } from "@/lib/routes";
import { EditElectionForm } from "./edit-election-form";
import type { Candidate, Election } from "@/types";

export default async function ElectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const supabase = createAdminClient();

  const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", slug).single();
  if (!tenant) notFound();

  const access = await requireTenantAccess(tenant.id);
  if (!access.ok) redirect("/masuk");

  const { data: election } = await supabase
    .from("elections")
    .select("*, candidates(*)")
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!election) notFound();

  const { count: voteCount } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("election_id", id);

  const { count: voterCount } = await supabase
    .from("voters")
    .select("id", { count: "exact", head: true })
    .eq("election_id", id);

  const hasVotes = (voteCount ?? 0) > 0;
  const candidates = ((election.candidates ?? []) as unknown as Candidate[])
    .slice()
    .sort((a, b) => a.candidate_number - b.candidate_number);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={adminElections()} className="text-sm text-muted-foreground hover:underline">
            ← Kembali ke daftar
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold">{election.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatDateTimeID(election.start_time)} — {formatDateTimeID(election.end_time)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {election.status === "DRAFT" && (
              <PublishElectionButton electionId={id} disabled={candidates.length < 2} />
            )}
            {(election.status === "SCHEDULED" || election.status === "ONGOING") && (
              <CloseElectionButton electionId={id} />
            )}
            <Link
              href={adminBranding(id)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 font-semibold hover:bg-muted"
            >
              Atur Tampilan
            </Link>
            <Link
              href={`/admin/pemilihan/${id}/laporan`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 font-semibold hover:bg-muted"
            >
              Laporan
            </Link>
            <Link
              href={`/admin/pemilihan/${id}/audit`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 font-semibold hover:bg-muted"
            >
              Audit Log
            </Link>
          </div>
        </div>

        {hasVotes && (
          <div className="rounded-3xl border border-info bg-background p-4 text-sm">
            <p className="font-semibold text-info">ℹ️ Pemilihan sudah menerima suara</p>
            <p className="mt-1 text-muted-foreground">
              Jadwal, mode voting, dan daftar paslon tidak bisa diubah untuk menjaga integritas hasil.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard title="Status" value={election.status} />
          <InfoCard title="Mode Voting" value={election.voting_mode} />
          <InfoCard title="DPT" value={`${voterCount ?? 0} pemilih`} />
        </div>

        <EditElectionForm election={election as unknown as Election} locked={hasVotes} />

        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-bold">Pasangan Calon ({candidates.length})</h2>
            <div className="flex gap-2">
              <Link
                href={`/admin/dpt?election=${id}`}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-muted"
              >
                Kelola DPT
              </Link>
              <Link
                href={`/admin/paslon?election=${id}`}
                className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                Kelola Paslon
              </Link>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {candidates.length === 0 ? (
              <p className="text-muted-foreground">
                Belum ada paslon. Tambahkan minimal 2 paslon sebelum mempublikasikan pemilihan.
              </p>
            ) : (
              candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary font-display text-3xl font-bold text-foreground">
                    {candidate.candidate_number}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{candidate.name}</p>
                    {candidate.running_mate && (
                      <p className="text-sm text-muted-foreground">{candidate.running_mate}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {!hasVotes && election.status === "DRAFT" && (
          <section className="rounded-3xl border border-destructive/40 bg-card p-6">
            <h2 className="font-display text-xl font-bold text-destructive">Zona Bahaya</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Aksi di bawah tidak bisa dibatalkan. Pastikan kamu yakin sebelum melanjutkan.
            </p>
            <DeleteElectionButton electionId={id} electionTitle={election.title} />
          </section>
        )}
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-3 font-semibold">{value}</p>
    </div>
  );
}
