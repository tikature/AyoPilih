"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCandidate } from "@/app/actions/candidate";

export function DeleteCandidateButton({
  candidateId,
  candidateName,
}: {
  candidateId: string;
  candidateName: string;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCandidate(candidateId);
      if (result.ok) {
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="inline-flex h-10 items-center justify-center rounded-full border border-destructive px-4 text-sm font-semibold text-destructive hover:bg-destructive hover:text-primary-foreground"
      >
        Hapus
      </button>
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6">
            <h3 className="font-display text-xl font-bold">Hapus paslon?</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Paslon <strong>{candidateName}</strong> akan dihapus permanen.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="h-11 flex-1 rounded-full border border-border bg-background font-semibold disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="h-11 flex-1 rounded-full bg-destructive font-semibold text-primary-foreground disabled:opacity-60"
              >
                {isPending ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
