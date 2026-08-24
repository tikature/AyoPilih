import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "../login-form";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ electionSlug: string }>;
}) {
  const { electionSlug } = await params;
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, title, status, start_time, end_time")
    .eq("slug", electionSlug)
    .maybeSingle();

  if (!election) notFound();

  const now = Date.now();
  const isOpen = now >= new Date(election.start_time).getTime() && now <= new Date(election.end_time).getTime() && election.status !== "CLOSED";

  return (
    <main className="min-h-dvh bg-background px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3 text-center">
          <h1 className="font-display text-3xl font-bold">{election.title}</h1>
          <p className="text-muted-foreground">Masukkan Token Pemilih</p>
        </div>

        {!isOpen ? (
          <div className="rounded-2xl border border-warning bg-background p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {now < new Date(election.start_time).getTime()
                ? "Pemilihan belum dibuka. Silakan kembali sesuai jadwal."
                : "Pemilihan sudah ditutup."}
            </p>
          </div>
        ) : (
          <LoginForm electionId={election.id} electionSlug={electionSlug} />
        )}
      </div>

      <footer className="mt-10 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        <p>Didukung oleh AyoPilih</p>
      </footer>
    </main>
  );
}
