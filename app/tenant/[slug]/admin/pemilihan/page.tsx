import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LIMITS } from "@/lib/plans";
import { formatDateTimeID } from "@/lib/utils";
import { adminElection } from "@/lib/routes";
import Link from "next/link";
import { ElectionForm } from "./election-form";
import type { PlanType } from "@/types";

export default async function ElectionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data: tenant } = await supabase.from("tenants").select("id, plan").eq("slug", slug).single();
  if (!tenant) return null;

  const [{ data: elections }, { count: activeCount }] = await Promise.all([
    supabase
      .from("elections")
      .select("id, title, slug, status, start_time, end_time, voting_mode")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("elections")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .in("status", ["DRAFT", "SCHEDULED", "ONGOING"]),
  ]);

  const limit = PLAN_LIMITS[tenant.plan as PlanType].maxActiveElections;
  const canCreate = (activeCount ?? 0) < limit;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Kelola Pemilihan</h1>
          <p className="mt-3 text-muted-foreground">
            {(activeCount ?? 0)}/{limit} pemilihan aktif
          </p>
        </div>
        {!canCreate && (
          <div className="rounded-2xl border border-warning bg-card px-4 py-2 text-sm text-warning">
            Batas pemilihan aktif tercapai. Naik ke paket Pro untuk menambah kapasitas.
          </div>
        )}
      </div>

      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold">Pemilihan Baru</h2>
        {canCreate ? (
          <div className="mt-5">
            <ElectionForm tenantId={tenant.id} />
          </div>
        ) : (
          <p className="mt-5 text-muted-foreground">
            Hapus atau selesaikan pemilihan yang ada untuk membuat yang baru.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold">Daftar Pemilihan</h2>
        <div className="mt-5 grid gap-3">
          {(elections ?? []).length === 0 ? (
            <p className="text-muted-foreground">Belum ada pemilihan.</p>
          ) : (
            elections?.map((election) => (
              <Link
                key={election.id}
                href={adminElection(election.id)}
                className="rounded-2xl border border-border bg-background p-5 hover:border-primary/40"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{election.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTimeID(election.start_time)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {election.voting_mode}
                    </span>
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
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
