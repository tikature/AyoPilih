"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { setVoterBlocked, deleteVoter } from "@/app/actions/voters";
import type { Voter } from "@/types";

const PAGE_SIZE = 20;

export function VoterTable({ voters, electionId }: { voters: Voter[]; electionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const currentQuery = searchParams.get("q") ?? "";
  const currentStatus = searchParams.get("status") ?? "all";

  const totalPages = Math.max(1, Math.ceil(voters.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => voters.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [voters, safePage],
  );

  function applyFilter(next: { q?: string; status?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("election", electionId);

    const q = next.q ?? currentQuery;
    const status = next.status ?? currentStatus;

    if (q) params.set("q", q);
    else params.delete("q");

    if (status && status !== "all") params.set("status", status);
    else params.delete("status");

    setPage(1);
    router.push(`/admin/dpt?${params.toString()}`);
  }

  function toggleBlock(voter: Voter) {
    setError("");
    startTransition(async () => {
      const result = await setVoterBlocked({
        electionId,
        voterId: voter.id,
        blocked: voter.status !== "BLOCKED",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function removeVoter(voter: Voter) {
    setError("");
    startTransition(async () => {
      const result = await deleteVoter({ electionId, voterId: voter.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          applyFilter({ q: String(formData.get("q") ?? "") });
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="flex-1">
          <label htmlFor="q" className="text-sm font-semibold">
            Cari pemilih
          </label>
          <input
            id="q"
            name="q"
            defaultValue={currentQuery}
            placeholder="Nama atau NISN/NIM"
            className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="status" className="text-sm font-semibold">
            Status
          </label>
          <select
            id="status"
            defaultValue={currentStatus}
            onChange={(event) => applyFilter({ status: event.target.value })}
            className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Semua</option>
            <option value="pending">Belum memilih</option>
            <option value="voted">Sudah memilih</option>
            <option value="blocked">Diblokir</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="h-12 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover">
            Cari
          </button>
        </div>
      </form>

      {error && (
        <p className="rounded-xl border border-destructive bg-background p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {voters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center">
          <p className="text-muted-foreground">
            Belum ada pemilih yang cocok. Unggah berkas DPT atau tambahkan pemilih secara manual.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: daftar kartu */}
          <div className="grid gap-3 md:hidden">
            {pageRows.map((voter) => (
              <div key={voter.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{voter.name}</p>
                    <p className="font-mono text-sm text-muted-foreground">{voter.identifier}</p>
                    {voter.group_name && (
                      <p className="text-sm text-muted-foreground">{voter.group_name}</p>
                    )}
                  </div>
                  <StatusBadge voter={voter} />
                </div>
                <VoterActions
                  voter={voter}
                  electionId={electionId}
                  isPending={isPending}
                  onToggleBlock={() => toggleBlock(voter)}
                  onDelete={() => removeVoter(voter)}
                />
              </div>
            ))}
          </div>

          {/* Desktop: tabel */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-3">Identitas</th>
                  <th className="p-3">Nama</th>
                  <th className="p-3">Kelas/Prodi</th>
                  <th className="p-3">Token</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((voter) => (
                  <tr key={voter.id} className="border-b border-border/60">
                    <td className="p-3 font-mono">{voter.identifier}</td>
                    <td className="p-3 font-medium">{voter.name}</td>
                    <td className="p-3 text-muted-foreground">{voter.group_name ?? "-"}</td>
                    <td className="p-3 text-muted-foreground">
                      {voter.token_hash ? "Sudah dibuat" : "Belum dibuat"}
                    </td>
                    <td className="p-3">
                      <StatusBadge voter={voter} />
                    </td>
                    <td className="p-3">
                      <VoterActions
                        voter={voter}
                        electionId={electionId}
                        isPending={isPending}
                        align="right"
                        onToggleBlock={() => toggleBlock(voter)}
                        onDelete={() => removeVoter(voter)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Halaman {safePage} dari {totalPages} · {voters.length} pemilih
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="h-10 rounded-full border border-border bg-background px-4 text-sm font-semibold disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="h-10 rounded-full border border-border bg-background px-4 text-sm font-semibold disabled:opacity-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ voter }: { voter: Voter }) {
  const label = voter.has_voted
    ? "Sudah memilih"
    : voter.status === "BLOCKED"
      ? "Diblokir"
      : "Belum memilih";

  const tone = voter.has_voted
    ? "bg-success/10 text-success"
    : voter.status === "BLOCKED"
      ? "bg-destructive/10 text-destructive"
      : "bg-secondary text-secondary-foreground";

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function VoterActions({
  voter,
  electionId,
  isPending,
  align = "left",
  onToggleBlock,
  onDelete,
}: {
  voter: Voter;
  electionId: string;
  isPending: boolean;
  align?: "left" | "right";
  onToggleBlock: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`mt-4 flex flex-wrap gap-2 md:mt-0 ${align === "right" ? "md:justify-end" : ""}`}>
      {!voter.has_voted && (
        <Link
          href={`/admin/dpt/${voter.id}/edit?election=${electionId}`}
          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-muted"
        >
          Edit
        </Link>
      )}
      {!voter.has_voted && (
        <button
          onClick={onToggleBlock}
          disabled={isPending}
          className="h-10 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60"
        >
          {voter.status === "BLOCKED" ? "Buka Blokir" : "Blokir"}
        </button>
      )}
      {!voter.has_voted && (
        <button
          onClick={onDelete}
          disabled={isPending}
          className="h-10 rounded-full border border-destructive px-4 text-sm font-semibold text-destructive hover:bg-destructive hover:text-primary-foreground disabled:opacity-60"
        >
          Hapus
        </button>
      )}
    </div>
  );
}
