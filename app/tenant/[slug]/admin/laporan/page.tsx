import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { FileOutput } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { formatDateTimeID } from "@/lib/utils";

export default async function LaporanPage({
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

  // Mode 1: ?election= -> redirect ke halaman laporan per pemilihan
  if (electionId) {
    const { data: election } = await supabase
      .from("elections")
      .select("id")
      .eq("id", electionId)
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    if (!election) notFound();

    redirect(`/admin/pemilihan/${electionId}/laporan`);
  }

  // Mode 2: tanpa ?election= -> daftar pemilihan
  const { data: elections } = await supabase
    .from("elections")
    .select("id, title, slug, status, start_time, end_time")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  const list = elections ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Laporan & Berita Acara</h1>
        <p className="mt-3 text-muted-foreground">
          Pilih pemilihan untuk mengunduh rekap suara, daftar hadir, audit log,
          dan berita acara PDF.
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
                href={`/admin/laporan?election=${election.id}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4 hover:border-primary/40"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileOutput className="h-5 w-5" aria-hidden="true" />
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