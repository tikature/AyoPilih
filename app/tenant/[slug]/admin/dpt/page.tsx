import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { PLAN_LIMITS, quotaPercentage } from "@/lib/plans";
import { voterInviteUrl, adminHome } from "@/lib/routes";
import type { Voter, PlanType } from "@/types";
import { VoterUpload } from "./voter-upload";
import { VoterTable } from "./voter-table";
import { TokenPanel } from "./token-panel";

export default async function DPTPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ election?: string; q?: string; status?: string }>;
}) {
  const [{ slug }, { election: electionId, q, status }] = await Promise.all([params, searchParams]);
  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, plan")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) notFound();

  const access = await requireTenantAccess(tenant.id);
  if (!access.ok) notFound();

  const { data: elections } = await supabase
    .from("elections")
    .select("id, title, status")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  if (!electionId) {
    return (
      <Shell title="Daftar Pemilih Tetap (DPT)" subtitle="Pilih pemilihan untuk mengelola DPT">
        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="grid gap-3">
            {(elections ?? []).length === 0 ? (
              <EmptyState message="Belum ada pemilihan. Buat pemilihan dulu di menu Kelola Pemilihan." />
            ) : (
              elections?.map((election) => (
                <Link
                  key={election.id}
                  href={`/admin/dpt?election=${election.id}`}
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
    .select("id, title, slug, tenant_id, status")
    .eq("id", electionId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!election) notFound();

  let query = supabase
    .from("voters")
    .select("*", { count: "exact" })
    .eq("election_id", electionId)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,identifier.ilike.%${q}%`);
  }
  if (status && status !== "all") {
    if (status === "voted") query = query.eq("has_voted", true);
    else if (status === "pending") query = query.eq("has_voted", false);
    else query = query.eq("status", status.toUpperCase());
  }

  const { data: voters, count } = await query;

  const limits = PLAN_LIMITS[tenant.plan as PlanType];
  const quota = quotaPercentage(tenant.plan as PlanType, count ?? 0);

  return (
    <Shell title={election.title} subtitle={`${count ?? 0} pemilih terdaftar`}>
      {quota >= 80 && (
        <div className="rounded-3xl border border-warning bg-card p-4 text-sm">
          <p className="font-semibold text-warning">⚠️ Kuota pemilih {quota}%</p>
          <p className="mt-1 text-muted-foreground">
            Paket {limits.label} menampung {limits.maxVoters} pemilih. Naik ke paket yang lebih besar
            untuk menambah kapasitas.
          </p>
        </div>
      )}

      <VoterUpload electionId={election.id} />

      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-xl font-bold">Data Pemilih</h2>
          <div className="flex gap-2">
            <a
              href="/api/template-dpt"
              download
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-muted"
            >
              Unduh Template
            </a>
            <Link
              href={`/admin/dpt/baru?election=${election.id}`}
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Tambah Manual
            </Link>
          </div>
        </div>

        <div className="mt-5">
          <VoterTable voters={(voters ?? []) as unknown as Voter[]} electionId={election.id} />
        </div>
      </section>

      <TokenPanel
        electionId={election.id}
        voters={(voters ?? []) as unknown as Voter[]}
        votingUrl={voterInviteUrl(slug, election.slug)}
      />
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
        <Link href={adminHome()} className="text-sm text-muted-foreground hover:underline">
          ← Kembali ke dashboard
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">{title}</h1>
        <p className="mt-3 text-muted-foreground">{subtitle}</p>
      </div>
      {children}
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
