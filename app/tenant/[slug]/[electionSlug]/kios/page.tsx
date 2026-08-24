import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KioskManager } from "./kiosk-manager";
import type { Candidate } from "@/types";

export default async function KioskPage({
  params,
}: {
  params: Promise<{ electionSlug: string }>;
}) {
  const { electionSlug } = await params;
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, title, voting_mode, allow_abstain, status, candidates(*)")
    .eq("slug", electionSlug)
    .maybeSingle();

  if (!election) notFound();

  // Route ditolak jika mode ONLINE_ONLY (SECURITY.md §10)
  if (election.voting_mode === "ONLINE_ONLY") {
    notFound();
  }

  const candidates = ((election.candidates || []) as unknown as Candidate[]).sort(
    (a, b) => a.candidate_number - b.candidate_number
  );

  return (
    <KioskManager
      electionId={election.id}
      electionTitle={election.title}
      candidates={candidates}
      allowAbstain={election.allow_abstain}
      electionSlug={electionSlug}
    />
  );
}
