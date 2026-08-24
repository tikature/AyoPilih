import { adminHome, adminElections, adminCandidatesByElection } from "@/lib/routes";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/plans";
import { DeleteCandidateButton } from "./candidate-actions";
import { ReorderCandidates } from "./reorder-candidates";
import type { Candidate, PlanType } from "@/types";

export default async function CandidatesPage({
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
    .select("id, plan")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) notFound();

  const access = await requireTenantAccess(tenant.id);
  if (!access.ok) redirect(adminHome());

  const { data: tenantElections } = await supabase
    .from("elections")
    .select("id, title, status")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  const elections = tenantElections ?? [];

  if (!electionId) {
    return (
      <Shell title="Pasangan Calon" subtitle="Pilih pemilihan yang ingin dikelola paslonnya.">
        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="grid gap-3">
            {elections.length === 0 ? (
              <EmptyState message="Belum ada pemilihan. Buat pemilihan dulu sebelum menambah paslon." />
            ) : (
              elections.map((election) => (
                <Link
                  key={election.id}
                  href={adminCandidatesByElection(election.id)}
                  className="rounded-2xl border border-border bg-background p-4 hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold">{election.title}</p>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                      {election.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </Shell>
    );
  }

  const { data: election } = await supabase
    .from("elections")
    .select("id, title, tenant_id")
    .eq("id", electionId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!election) notFound();

  const [{ data: candidateRows }, { count: voteCount }] = await Promise.all([
    supabase
      .from("candidates")
      .select("*")
      .eq("election_id", election.id)
      .order("candidate_number", { ascending: true }),
    supabase.from("votes").select("id", { count: "exact", head: true }).eq("election_id", election.id),
  ]);

  const candidates = (candidateRows ?? []) as unknown as Candidate[];
  const hasVotes = (voteCount ?? 0) > 0;
  const limits = PLAN_LIMITS[tenant.plan as PlanType];
  const canAdd = !hasVotes && candidates.length < limits.maxCandidates;

  return (
    <Shell title="Pasangan Calon" subtitle={election.title}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {candidates.length}/{limits.maxCandidates === Infinity ? "∞" : limits.maxCandidates} paslon
          terpakai pada paket {limits.label}.
        </p>
        {canAdd ? (
          <Link
            href={`/admin/paslon/baru?election=${election.id}`}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Tambah Paslon
          </Link>
        ) : null}
      </div>

      {hasVotes && (
        <div className="rounded-3xl border border-info bg-card p-4 text-sm">
          <p className="font-semibold text-info">Paslon terkunci</p>
          <p className="mt-1 text-muted-foreground">
            Pemilihan ini sudah menerima suara, jadi daftar paslon tidak bisa ditambah, diubah, atau
            dihapus demi menjaga keabsahan hasil.
          </p>
        </div>
      )}

      {!hasVotes && candidates.length >= limits.maxCandidates && (
        <div className="rounded-3xl border border-warning bg-card p-4 text-sm">
          <p className="font-semibold text-warning">Batas paslon paket {limits.label} tercapai</p>
          <p className="mt-1 text-muted-foreground">
            Paket {limits.label} mendukung {limits.maxCandidates} paslon dan saat ini sudah terisi{" "}
            {candidates.length}. Naik ke paket Pro untuk menambah paslon, atau hapus salah satu paslon.
          </p>
          <Link
            href="/harga"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Lihat Paket Pro
          </Link>
        </div>
      )}

      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold">Daftar Paslon</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nomor urut menentukan posisi paslon di bilik suara.
        </p>
        <div className="mt-5 grid gap-4">
          {candidates.length === 0 ? (
            <EmptyState message="Belum ada paslon. Tambahkan paslon pertama untuk memulai." />
          ) : (
            candidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} locked={hasVotes} />
            ))
          )}
        </div>
      </section>

      {!hasVotes && candidates.length > 1 && (
        <ReorderCandidates electionId={election.id} candidates={candidates} />
      )}
    </Shell>
  );
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <Link href={adminElections()} className="text-sm text-muted-foreground hover:underline">
          ← Kembali ke daftar pemilihan
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">{title}</h1>
        <p className="mt-3 text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function CandidateCard({ candidate, locked }: { candidate: Candidate; locked: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary font-display text-4xl font-bold text-foreground">
          {candidate.candidate_number}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{candidate.name}</p>
          {candidate.running_mate && (
            <p className="text-sm text-muted-foreground">Wakil: {candidate.running_mate}</p>
          )}
          {candidate.short_bio && (
            <p className="mt-2 text-sm text-muted-foreground">{candidate.short_bio}</p>
          )}
        </div>
        {!locked && (
          <div className="flex gap-2">
            <Link
              href={`/admin/paslon/${candidate.id}/edit?election=${candidate.election_id}`}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-muted"
            >
              Edit
            </Link>
            <DeleteCandidateButton candidateId={candidate.id} candidateName={candidate.name} />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
