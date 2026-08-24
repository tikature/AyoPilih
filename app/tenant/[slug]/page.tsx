import { notFound } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeID } from "@/lib/utils";
import { electionHome, adminHome } from "@/lib/routes";

export default async function TenantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const adminDb = createAdminClient();
  const supabase = await createClient();

  const { data: tenant } = await adminDb
    .from("tenants")
    .select("id, name, logo_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) notFound();

  const { data: elections } = await adminDb
    .from("elections")
    .select("id, title, slug, status, start_time, end_time, voting_mode")
    .eq("tenant_id", tenant.id)
    .in("status", ["SCHEDULED", "ONGOING", "CLOSED"])
    .order("start_time", { ascending: true });

  const activeElections = (elections ?? []).filter((el) => el.status !== "CLOSED");
  const closedElections = (elections ?? []).filter((el) => el.status === "CLOSED");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let showAdminLink = false;
  if (user) {
    const { data: membership } = await adminDb
      .from("tenant_members")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .maybeSingle();
    showAdminLink = !!membership;
  }

  return (
    <main className="min-h-dvh bg-muted px-4 py-10 flex flex-col justify-between">
      <div className="mx-auto max-w-4xl w-full space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-4">
            {tenant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logo_url} alt={tenant.name} className="h-16 w-16 object-contain rounded-xl" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-display text-2xl font-bold">
                {tenant.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-display text-3xl font-bold">{tenant.name}</h1>
              <p className="text-muted-foreground text-sm">Halaman pemilihan resmi</p>
            </div>
          </div>
          {showAdminLink && (
            <Link
              href={adminHome()}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
              Dasbor Admin
            </Link>
          )}
        </div>

        {/* Pemilihan Aktif / Berjalan */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-foreground">Pemilihan Aktif</h2>
          {activeElections.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-6 text-center text-muted-foreground">
              Tidak ada pemilihan yang sedang aktif saat ini.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeElections.map((election) => (
                <Link
                  key={election.id}
                  href={electionHome(election.slug)}
                  className="group block rounded-3xl border border-border bg-card p-6 hover:border-primary/40 transition"
                >
                  <div className="flex flex-col justify-between h-full space-y-4">
                    <div>
                      <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
                        {election.status === "ONGOING" ? "Berlangsung" : "Akan Mulai"}
                      </span>
                      <h3 className="font-display text-xl font-bold mt-3 group-hover:text-primary transition">
                        {election.title}
                      </h3>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Mulai: {formatDateTimeID(election.start_time)}</p>
                      <p>Selesai: {formatDateTimeID(election.end_time)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Pemilihan Selesai */}
        {closedElections.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-display text-2xl font-bold text-muted-foreground">Pemilihan Selesai</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {closedElections.map((election) => (
                <Link
                  key={election.id}
                  href={electionHome(election.slug)}
                  className="group block rounded-3xl border border-border bg-card p-6 hover:border-primary/40 transition opacity-80"
                >
                  <div className="flex flex-col justify-between h-full space-y-4">
                    <div>
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                        Selesai
                      </span>
                      <h3 className="font-display text-xl font-bold mt-3 group-hover:text-primary transition">
                        {election.title}
                      </h3>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>Selesai pada: {formatDateTimeID(election.end_time)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-border pt-10 text-center text-xs text-muted-foreground">
        <p>Didukung oleh AyoPilih</p>
      </footer>
    </main>
  );
}