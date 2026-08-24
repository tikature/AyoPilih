"use client";

import { useState, useTransition } from "react";
import { parseVoterFile, bulkInsertVoters } from "@/app/actions/voters";
import type { VoterImportPreview } from "@/types";

export function VoterUpload({ electionId }: { electionId: string }) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<VoterImportPreview | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleUpload() {
    if (!file) return;
    setError("");
    const formData = new FormData();
    formData.append("electionId", electionId);
    formData.append("file", file);

    startTransition(async () => {
      const result = await parseVoterFile(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(result.data);
      setStep("preview");
    });
  }

  function handleCommit() {
    if (!preview) return;
    setError("");
    startTransition(async () => {
      const result = await bulkInsertVoters({
        electionId,
        rows: preview.valid.map((row) => ({
          identifier: row.identifier,
          name: row.name,
          group_name: row.group_name,
          email: row.email,
          phone: row.phone,
        })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setStep("done");
      setPreview(null);
      setFile(null);
    });
  }

  function handleReset() {
    setStep("upload");
    setPreview(null);
    setFile(null);
    setError("");
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-6">
      <h2 className="font-display text-xl font-bold">Unggah DPT</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Format CSV atau XLSX. Maks 5 MB / 20.000 baris.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive bg-background p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === "upload" && (
        <div className="mt-5 space-y-4">
          <div>
            <input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-2xl border border-border bg-background p-4 text-sm"
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={!file || isPending}
            className="h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {isPending ? "Memproses..." : "Pratinjau Data"}
          </button>
        </div>
      )}

      {step === "preview" && preview && (
        <div className="mt-5 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total baris" value={preview.totalRows} />
            <StatCard label="Valid" value={preview.valid.length} highlight />
            <StatCard label="Ditolak" value={preview.rejected.length} warning={preview.rejected.length > 0} />
          </div>

          {preview.rejected.length > 0 && (
            <div className="rounded-2xl border border-warning bg-background p-4">
              <h3 className="font-semibold text-warning">Baris ditolak ({preview.rejected.length})</h3>
              <div className="mt-3 max-h-48 space-y-2 overflow-auto">
                {preview.rejected.map((row) => (
                  <div key={row.rowNumber} className="text-sm">
                    <span className="font-mono text-muted-foreground">Baris {row.rowNumber}:</span>{" "}
                    <span className="text-foreground">{row.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.valid.length > 0 && (
            <div className="rounded-2xl border border-border bg-background p-4">
              <h3 className="font-semibold">Data valid ({preview.valid.length})</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Kuota tersisa: {preview.quotaRemaining === Number.MAX_SAFE_INTEGER ? "∞" : preview.quotaRemaining}
              </p>
              <div className="mt-3 max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="p-2">Identitas</th>
                      <th className="p-2">Nama</th>
                      <th className="p-2">Kelas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.slice(0, 20).map((row) => (
                      <tr key={row.rowNumber} className="border-b border-border/50">
                        <td className="p-2 font-mono">{row.identifier}</td>
                        <td className="p-2">{row.name}</td>
                        <td className="p-2 text-muted-foreground">{row.group_name ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.valid.length > 20 && (
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    ...dan {preview.valid.length - 20} baris lainnya
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={isPending}
              className="h-11 flex-1 rounded-full border border-border bg-background font-semibold hover:bg-muted disabled:opacity-60"
            >
              Batal
            </button>
            <button
              onClick={handleCommit}
              disabled={isPending || preview.valid.length === 0 || preview.valid.length > preview.quotaRemaining}
              className="h-11 flex-1 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {isPending ? "Menyimpan..." : `Simpan ${preview.valid.length} Pemilih`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="mt-5 rounded-2xl border border-success bg-background p-4 text-center">
          <p className="font-semibold text-success">Data berhasil disimpan</p>
          <button
            onClick={handleReset}
            className="mt-4 h-10 rounded-full border border-border bg-background px-5 text-sm font-semibold hover:bg-muted"
          >
            Unggah Lagi
          </button>
        </div>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  highlight,
  warning,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight ? "border-success bg-success/5" : warning ? "border-warning bg-warning/5" : "border-border bg-background"
      }`}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-bold ${
          highlight ? "text-success" : warning ? "text-warning" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
