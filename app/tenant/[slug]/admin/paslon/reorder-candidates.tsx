"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reorderCandidates } from "@/app/actions/candidate";
import type { Candidate } from "@/types";

export function ReorderCandidates({
  electionId,
  candidates,
}: {
  electionId: string;
  candidates: Candidate[];
}) {
  const [numbers, setNumbers] = useState<Record<string, number>>(
    Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate.candidate_number])),
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await reorderCandidates(
        electionId,
        candidates.map((candidate) => ({
          candidateId: candidate.id,
          candidateNumber: numbers[candidate.id],
        })),
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Nomor urut tersimpan.");
      router.refresh();
    });
  }

  const values = Object.values(numbers);
  const hasDuplicate = new Set(values).size !== values.length;

  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <h3 className="font-semibold">Atur Nomor Urut</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Ubah angka lalu simpan. Nomor urut tidak boleh sama antar paslon.
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-destructive bg-card p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-xl border border-border bg-card p-3 text-sm text-success">{message}</p>
      )}

      <div className="mt-4 grid gap-3">
        {candidates.map((candidate) => (
          <div key={candidate.id} className="flex items-center gap-3">
            <label htmlFor={`order-${candidate.id}`} className="flex-1 text-sm">
              {candidate.name}
            </label>
            <input
              id={`order-${candidate.id}`}
              type="number"
              min={1}
              value={numbers[candidate.id]}
              onChange={(event) =>
                setNumbers((previous) => ({
                  ...previous,
                  [candidate.id]: Number(event.target.value),
                }))
              }
              className="min-h-11 w-24 rounded-full border border-border bg-card px-4 text-center font-mono outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
      </div>

      {hasDuplicate && (
        <p className="mt-3 text-sm text-warning">
          Ada nomor urut yang sama. Perbaiki dulu sebelum menyimpan.
        </p>
      )}

      <button
        onClick={save}
        disabled={isPending || hasDuplicate}
        className="mt-5 h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Simpan Urutan"}
      </button>
    </div>
  );
}
