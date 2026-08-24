import { notFound } from "next/navigation";
import { adminElection } from "@/lib/routes";
import Link from "next/link";
import { Palette } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAccess } from "@/lib/auth";
import { formatDateTimeID } from "@/lib/utils";
import { BrandingForm } from "./branding-form";
import type { Election } from "@/types";

export default async function TampilanPage({
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
    .select("id, plan, theme_color, logo_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) notFound();

  const access = await requireTenantAccess(tenant.id);
  if (!access.ok) notFound();

  // Mode 1: Edit Branding Form (jika ?election= disetor)
  if (electionId) {
    const { data: election } = await supabase
      .from("elections")
      .select("*")
      .eq("id", electionId)
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    if (!election) notFound();

    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <Link href={adminElection(election.id)} className="text-sm text-muted-foreground hover:underline">
            ← Kembali ke detail pemilihan
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold">Tampilan Pemilihan</h1>
          <p className="mt-3 text-muted-foreground">{election.title}</p>
        </div>
        <BrandingForm
          election={election as unknown as Election}
          tenant={{
            id: tenant.id,
            plan: tenant.plan,
            theme_color: tenant.theme_color,
            logo_url: tenant.logo_url,
          }}
        />
      </div>
    );
  }

  // Mode 2: Daftar Pemilihan (jika tidak ada query ?election=)
  const { data: elections } = await supabase
    .from("elections")
    .select("id, title, slug, status, start_time")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  const list = elections ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Tampilan Pemilihan</h1>
        <p className="mt-3 text-muted-foreground">
          Pilih pemilihan yang ingin diatur brandingnya — logo, warna tema,
          banner, deskripsi, dan timeline.
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
                href={`/admin/tampilan?election=${election.id}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4 hover:border-primary/40"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Palette className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold">{election.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Mulai {formatDateTimeID(election.start_time)}
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