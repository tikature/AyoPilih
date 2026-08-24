import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { electionHome } from "@/lib/routes";
import type { Candidate } from "@/types";

export default async function CandidatesPage({
  params,
}: {
  params: Promise<{ electionSlug: string }>;
}) {
  const { electionSlug } = await params;
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, title, candidates(*)")
    .eq("slug", electionSlug)
    .maybeSingle();

  if (!election) notFound();

  const candidates = ((election.candidates || []) as unknown as Candidate[]).sort(
    (a, b) => a.candidate_number - b.candidate_number
  );

  return (
    <main className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-10">
        <div>
          <Link
            href={electionHome(electionSlug)}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Kembali ke Halaman Pemilihan
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold">Profil Pasangan Calon</h1>
          <p className="mt-2 text-muted-foreground">{election.title}</p>
        </div>

        {candidates.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">Belum ada informasi paslon.</p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 flex flex-col justify-between"
              >
                {/* Visual signature: huge candidate number cut off/placed in top corner */}
                <div className="absolute -top-4 -right-4 font-display text-8xl font-black text-muted opacity-25 select-none pointer-events-none">
                  {candidate.candidate_number}
                </div>

                <div className="space-y-4">
                  {candidate.photo_url ? (
                    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-muted">
                      <Image
                        src={candidate.photo_url}
                        alt={candidate.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-[4/5] w-full rounded-2xl bg-muted flex items-center justify-center">
                      <span className="text-sm text-muted-foreground font-semibold">Tidak ada foto</span>
                    </div>
                  )}

                  <div>
                    <span className="font-display text-lg font-bold text-primary block">
                      Paslon #{candidate.candidate_number}
                    </span>
                    <h2 className="font-display text-2xl font-bold tracking-tight mt-1">{candidate.name}</h2>
                    {candidate.running_mate && (
                      <p className="text-lg text-muted-foreground mt-1">
                        Wakil: <span className="font-semibold">{candidate.running_mate}</span>
                      </p>
                    )}
                  </div>

                  {candidate.short_bio && (
                    <p className="text-sm text-muted-foreground italic">{candidate.short_bio}</p>
                  )}

                  {candidate.vision && (
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground">Visi</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{candidate.vision}</p>
                    </div>
                  )}

                  {candidate.mission && (
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground">Misi</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{candidate.mission}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="mt-10 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        <p>Didukung oleh AyoPilih</p>
      </footer>
    </main>
  );
}
