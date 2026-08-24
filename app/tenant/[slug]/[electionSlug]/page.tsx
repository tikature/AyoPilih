import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Countdown } from "./countdown";
import type { Candidate, TimelineItem, Tenant } from "@/types";
import { electionCandidates, electionLogin, electionResult } from "@/lib/routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; electionSlug: string }>;
}) {
  const { electionSlug } = await params;
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("title, description, banner_url, tenant:tenants(logo_url, name)")
    .eq("slug", electionSlug)
    .maybeSingle();

  if (!election) return { title: "Pemilihan Tidak Ditemukan" };

  const tenantData = election.tenant as unknown as Tenant;
  const tenantName = tenantData?.name || "AyoPilih";

  return {
    title: election.title,
    description: election.description || `Pemilihan untuk ${tenantName}`,
    openGraph: {
      title: election.title,
      description: election.description,
      images: election.banner_url ? [{ url: election.banner_url }] : [],
    },
  };
}

export default async function ElectionPage({
  params,
}: {
  params: Promise<{ electionSlug: string }>;
}) {
  const { electionSlug } = await params;
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("*, candidates(*), tenant:tenants(id, name, logo_url, theme_color)")
    .eq("slug", electionSlug)
    .maybeSingle();

  if (!election) notFound();

  const candidates = ((election.candidates || []) as unknown as Candidate[]).sort((a: Candidate, b: Candidate) => a.candidate_number - b.candidate_number);
  const now = new Date();
  const startTime = new Date(election.start_time);
  const endTime = new Date(election.end_time);
  const isOpen = now >= startTime && now <= endTime;
  const hasEnded = now > endTime;

  return (
    <main className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-10">
        {/* Header */}
        <div className="space-y-4">
          {election.banner_url && (
            <div className="relative h-48 overflow-hidden rounded-3xl bg-muted md:h-80">
              <Image
                src={election.banner_url}
                alt={election.title}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div>
            <h1 className="font-display text-4xl font-bold">{election.title}</h1>
            {election.subtitle && (
              <p className="mt-2 text-lg text-muted-foreground">{election.subtitle}</p>
            )}
            <div className="mt-4">
              <Countdown startTime={election.start_time} endTime={election.end_time} />
            </div>
          </div>
        </div>

        {/* Deskripsi */}
        {election.description && (
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="prose prose-sm max-w-none">
              <p className="text-muted-foreground">{election.description}</p>
            </div>
          </section>
        )}

        {/* Timeline */}
        {election.timeline && election.timeline.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-display text-2xl font-bold">Timeline Pemilihan</h2>
            <div className="grid gap-3">
              {(election.timeline as unknown as TimelineItem[]).map((item: TimelineItem, index: number) => (
                <div key={index} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(item.start).toLocaleDateString("id-ID")} —{" "}
                    {new Date(item.end).toLocaleDateString("id-ID")}
                  </p>
                  {item.description && (
                    <p className="mt-2 text-sm">{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Paslon */}
        {election.show_candidates_before_login && candidates.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-display text-2xl font-bold">Pasangan Calon</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {candidates.map((candidate: Candidate) => (
                <Link
                  key={candidate.id}
                  href={electionCandidates(electionSlug)}
                  className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/40"
                >
                  <div className="flex gap-4">
                    <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl bg-muted font-display text-3xl font-bold text-muted-foreground">
                      {candidate.candidate_number}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{candidate.name}</p>
                      {candidate.running_mate && (
                        <p className="text-sm text-muted-foreground">{candidate.running_mate}</p>
                      )}
                      {candidate.short_bio && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {candidate.short_bio}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="space-y-4">
          {!isOpen && !hasEnded && (
            <div className="rounded-3xl border border-border bg-card p-6 text-center">
              <p className="text-muted-foreground">Pemilihan belum dimulai. Silakan cek jadwal di atas.</p>
            </div>
          )}
          {isOpen && (
            <Link
              href={electionLogin(electionSlug)}
              className="block rounded-full bg-primary py-4 text-center font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Masuk Bilik Suara
            </Link>
          )}
          {hasEnded && election.show_public_result && (
            <Link
              href={electionResult(electionSlug)}
              className="block rounded-full bg-primary py-4 text-center font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Lihat Hasil
            </Link>
          )}
          {hasEnded && !election.show_public_result && (
            <div className="rounded-3xl border border-border bg-card p-6 text-center">
              <p className="text-muted-foreground">Pemilihan telah selesai.</p>
            </div>
          )}
        </section>

        {/* Kontak */}
        {election.contact_info && (
          <section className="rounded-3xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Pertanyaan? Hubungi:</p>
            <p className="mt-2 text-sm font-semibold">{election.contact_info}</p>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-border pt-10 text-center text-sm text-muted-foreground">
          <p>Didukung oleh AyoPilih</p>
        </footer>
      </div>
    </main>
  );
}
