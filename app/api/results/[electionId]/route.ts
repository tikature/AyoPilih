import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ electionId: string }> },
) {
  const { electionId } = await params;

  const supabase = await createClient();

  // Verify election exists and allows public results
  const { data: election } = await supabase
    .from("elections")
    .select("id, show_public_result")
    .eq("id", electionId)
    .maybeSingle();

  if (!election || !election.show_public_result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch live count and turnout
  const [{ data: liveCountData }, { data: turnoutData }] = await Promise.all([
    supabase.rpc("get_live_count", { p_election_id: electionId }),
    supabase.rpc("get_turnout", { p_election_id: electionId }),
  ]);

  const turnoutRow = (turnoutData ?? [])[0] as
    | { total_voters: number; voted: number }
    | undefined;

  return NextResponse.json({
    liveCount: liveCountData ?? [],
    turnout: {
      total_voters: turnoutRow?.total_voters ?? 0,
      voted: turnoutRow?.voted ?? 0,
      percentage:
        turnoutRow && turnoutRow.total_voters > 0
          ? Math.round((turnoutRow.voted / turnoutRow.total_voters) * 10000) / 100
          : 0,
    },
  });
}