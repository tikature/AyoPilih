"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitVote } from "@/app/actions/vote";
import { electionDone } from "@/lib/routes";
import type { Candidate } from "@/types";

export function BallotBox({
  electionId,
  candidates,
  allowAbstain,
  electionSlug,
}: {
  electionId: string;
  candidates: Candidate[];
  allowAbstain: boolean;
  electionSlug: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const selectedCandidate = candidates.find((c) => c.id === selected);

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await submitVote({
        electionId,
        candidateId: selected || null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`${electionDone(electionSlug)}?receipt=${result.data.receipt}`);
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-destructive bg-background p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {candidates.map((candidate) => (
          <label key={candidate.id} className="flex items-center gap-4 rounded-2xl border-2 border-border bg-background p-6 cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5 min-h-24">
            <input
              type="radio"
              name="candidate"
              value={candidate.id}
              checked={selected === candidate.id}
              onChange={(e) => setSelected(e.target.value)}
              disabled={isPending}
              className="h-6 w-6 cursor-pointer"
            />
            <div className="flex-1">
              <p className="font-display text-2xl font-bold text-muted-foreground">{candidate.candidate_number}</p>
              <p className="font-semibold">{candidate.name}</p>
              {candidate.running_mate && (
                <p className="text-sm text-muted-foreground">{candidate.running_mate}</p>
              )}
            </div>
          </label>
        ))}

        {allowAbstain && (
          <label className="flex items-center gap-4 rounded-2xl border-2 border-border bg-background p-6 cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5 min-h-24">
            <input
              type="radio"
              name="candidate"
              value=""
              checked={selected === null}
              onChange={() => setSelected(null)}
              disabled={isPending}
              className="h-6 w-6 cursor-pointer"
            />
            <div className="flex-1">
              <p className="font-semibold">Abstain (Kotak Kosong)</p>
              <p className="text-sm text-muted-foreground">Tidak memilih paslon manapun</p>
            </div>
          </label>
        )}
      </div>

      <button
        onClick={() => setShowConfirm(true)}
        disabled={selected === undefined || isPending}
        className="w-full h-14 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        Lanjut ke Konfirmasi
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 space-y-6">
            <h2 className="font-display text-2xl font-bold">Konfirmasi Pilihan</h2>

            {selected === null && allowAbstain ? (
              <p className="text-center text-lg font-semibold">Anda memilih: Abstain (Kotak Kosong)</p>
            ) : selectedCandidate ? (
              <div className="rounded-2xl border border-border bg-background p-4 text-center">
                <p className="font-display text-4xl font-bold text-muted-foreground">{selectedCandidate.candidate_number}</p>
                <p className="mt-3 font-semibold">{selectedCandidate.name}</p>
                {selectedCandidate.running_mate && (
                  <p className="text-sm text-muted-foreground">{selectedCandidate.running_mate}</p>
                )}
              </div>
            ) : null}

            <p className="text-sm text-muted-foreground text-center">
              Pastikan pilihan Anda sudah benar. Klik &quot;Kirim Suara&quot; untuk melanjutkan.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="flex-1 h-12 rounded-full border border-border bg-background font-semibold hover:bg-muted disabled:opacity-60"
              >
                Kembali Ubah
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex-1 h-12 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {isPending ? "Mengirim..." : "Kirim Suara"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
