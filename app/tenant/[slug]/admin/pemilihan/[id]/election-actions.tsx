"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteElection, publishElection, closeElection } from "@/app/actions/election";
import { adminElections } from "@/lib/routes";

export function DeleteElectionButton({
  electionId,
  electionTitle,
}: {
  electionId: string;
  electionTitle: string;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteElection(electionId);
      if (result.ok) {
        router.push(adminElections());
      } else {
        alert(result.error);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="mt-4 h-10 rounded-full border border-destructive px-4 text-sm font-semibold text-destructive hover:bg-destructive hover:text-primary-foreground"
      >
        Hapus Pemilihan
      </button>
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6">
            <h3 className="font-display text-xl font-bold">Hapus pemilihan ini?</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Pemilihan <strong>{electionTitle}</strong> akan dihapus permanen. Aksi ini tidak bisa
              dibatalkan.
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

export function PublishElectionButton({
  electionId,
  disabled,
}: {
  electionId: string;
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handlePublish() {
    startTransition(async () => {
      const result = await publishElection(electionId);
      if (result.ok) {
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  return (
    <button
      onClick={handlePublish}
      disabled={isPending || disabled}
      className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      title={disabled ? "Tambahkan minimal 2 paslon sebelum publikasi" : ""}
    >
      {isPending ? "Mempublikasikan..." : "Publikasikan"}
    </button>
  );
}

export function CloseElectionButton({ electionId }: { electionId: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClose() {
    startTransition(async () => {
      const result = await closeElection(electionId);
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
        className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 font-semibold hover:bg-muted"
      >
        Tutup Pemilihan
      </button>
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6">
            <h3 className="font-display text-xl font-bold">Tutup pemilihan ini?</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Setelah ditutup, tidak ada suara baru yang bisa masuk dan hasil menjadi final.
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
                onClick={handleClose}
                disabled={isPending}
                className="h-11 flex-1 rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-60"
              >
                {isPending ? "Menutup..." : "Ya, Tutup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
