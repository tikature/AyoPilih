import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBoothSession } from "@/app/actions/vote";
import { BallotBox } from "./ballot-box";
import { electionLogin } from "@/lib/routes";
import type { Candidate } from "@/types";

export default async function BoothPage({
  params,
}: {
  params: Promise<{ slug: string; electionSlug: string }>;
}) {
  const { electionSlug } = await params;
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, title, allow_abstain, candidates(*)")
    .eq("slug", electionSlug)
    .maybeSingle();

  if (!election) notFound();

  const sessionResult = await getBoothSession(election.id);
  if (!sessionResult.ok) {
    redirect(electionLogin(electionSlug));
  }

  const candidates = ((election.candidates || []) as unknown as Candidate[]).sort((a, b) => a.candidate_number - b.candidate_number);

  return (
    <main className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold">Bilik Suara</h1>
          <p className="mt-2 text-muted-foreground">{election.title}</p>
        </div>

        <BallotBox
          electionId={election.id}
          candidates={candidates}
          allowAbstain={election.allow_abstain}
          electionSlug={electionSlug}
        />

        <footer className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <p>Didukung oleh AyoPilih</p>
        </footer>
      </div>
    </main>
  );
}
