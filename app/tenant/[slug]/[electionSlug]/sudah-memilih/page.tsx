import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { electionHome } from "@/lib/routes";

export default async function AlreadyVotedPage({
  params,
}: {
  params: Promise<{ electionSlug: string }>;
}) {
  const { electionSlug } = await params;
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, title")
    .eq("slug", electionSlug)
    .maybeSingle();

  if (!election) notFound();

  const { data: voters } = await supabase
    .from("voters")
    .select("voted_at")
    .eq("election_id", election.id)
    .eq("has_voted", true)
    .order("voted_at", { ascending: false })
    .limit(1);

  const votedAt = voters?.[0]?.voted_at;

  return (
    <main className="min-h-dvh bg-background px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center space-y-6">
        <div>
          <p className="text-5xl">✓</p>
          <h1 className="mt-4 font-display text-2xl font-bold">Anda Sudah Memilih</h1>
        </div>

        {votedAt && (
          <div className="rounded-2xl bg-muted p-4">
            <p className="text-sm text-muted-foreground">Waktu pemilihan:</p>
            <p className="mt-2 font-mono text-sm">
              {new Date(votedAt).toLocaleString("id-ID")}
            </p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Token Anda sudah digunakan untuk memberikan suara. Setiap orang hanya boleh memilih sekali.
        </p>

        <Link
          href={electionHome(electionSlug)}
          className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-background px-6 font-semibold hover:bg-muted"
        >
          Kembali ke Halaman Pemilihan
        </Link>

        <footer className="mt-10 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <p>Didukung oleh AyoPilih</p>
        </footer>
      </div>
    </main>
  );
}
