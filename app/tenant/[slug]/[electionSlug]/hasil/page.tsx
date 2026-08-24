import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResultsClient } from "./results-client";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ slug: string; electionSlug: string }>;
}) {
  const { slug, electionSlug } = await params;
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, title, status, show_public_result, start_time, end_time, tenant:tenants(id, name, logo_url, theme_color)")
    .eq("slug", electionSlug)
    .maybeSingle();

  if (!election) notFound();

  if (!election.show_public_result) {
    notFound();
  }

  const initialData = await getInitialResultsData(election.id);

  return (
    <main className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-10">
        <ResultsClient
          electionId={election.id}
          electionTitle={election.title}
          electionStatus={election.status}
          initialData={initialData}
        />

        <div className="text-center pt-8">
          <Link
            href={`/${slug}/${electionSlug}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Kembali ke Halaman Pemilihan
          </Link>
        </div>

        <footer className="border-t border-border pt-10 text-center text-sm text-muted-foreground">
          <p>Didukung oleh AyoPilih</p>
        </footer>
      </div>
    </main>
  );
}

async function getInitialResultsData(electionId: string) {
  const supabase = await createClient();

  const [{ data: liveCountData }, { data: turnoutData }] = await Promise.all([
    supabase.rpc("get_live_count", { p_election_id: electionId }),
    supabase.rpc("get_turnout", { p_election_id: electionId }),
  ]);

  const turnoutRow = (turnoutData ?? [])[0] as
    | { total_voters: number; voted: number }
    | undefined;

  return {
    liveCount: (liveCountData ?? []) as { candidate_id: string; candidate_number: number; name: string; total: number }[],
    turnout: {
      total_voters: turnoutRow?.total_voters ?? 0,
      voted: turnoutRow?.voted ?? 0,
      percentage:
        turnoutRow && turnoutRow.total_voters > 0
          ? Math.round((turnoutRow.voted / turnoutRow.total_voters) * 10000) / 100
          : 0,
    },
  };
}