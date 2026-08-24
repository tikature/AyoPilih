"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { generateVoterTokens } from "@/app/actions/voters";
import type { GeneratedToken, Voter } from "@/types";

export function TokenPanel({
  electionId,
  voters,
  votingUrl,
}: {
  electionId: string;
  voters: Voter[];
  votingUrl: string;
}) {
  const [tokens, setTokens] = useState<GeneratedToken[]>([]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const withoutToken = voters.filter((voter) => !voter.token_hash && !voter.has_voted).length;

  function generate(scope: "pending" | "all") {
    setError("");
    startTransition(async () => {
      const result = await generateVoterTokens({ electionId, scope });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTokens(result.data);
      router.refresh();
    });
  }

  function downloadCsv() {
    const escape = (value: string) => {
      const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safe.replace(/"/g, '""')}"`;
    };

    const rows = [
      ["identifier", "name", "group", "token"],
      ...tokens.map((token) => [
        token.identifier,
        token.name,
        token.group_name ?? "",
        token.token,
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => escape(String(cell))).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}\r\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kartu-token-${electionId.slice(0, 8)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function printCards() {
    const cards = await Promise.all(
      tokens.map(async (token) => {
        const qr = await QRCode.toDataURL(`${votingUrl}?token=${token.token}`, {
          margin: 0,
          width: 220,
        });
        return { ...token, qr };
      }),
    );

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      setError("Popup diblokir browser. Izinkan popup untuk mencetak kartu token.");
      return;
    }

    const cardHtml = cards
      .map(
        (card) => `
          <div class="card">
            <div class="info">
              <p class="name">${escapeHtml(card.name)}</p>
              <p class="meta">${escapeHtml(card.identifier)}${card.group_name ? ` &middot; ${escapeHtml(card.group_name)}` : ""}</p>
              <p class="label">Token Pemilih</p>
              <p class="token">${card.token}</p>
              <p class="url">${escapeHtml(votingUrl)}</p>
            </div>
            <img class="qr" src="${card.qr}" alt="Kode QR menuju halaman masuk untuk ${escapeHtml(card.name)}" />
          </div>`,
      )
      .join("");

    printWindow.document.write(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Kartu Token Pemilih</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #030303; }
  .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  .card {
    display: flex; align-items: center; justify-content: space-between; gap: 4mm;
    border: 1px dashed #A8A9AB; border-radius: 4mm; padding: 5mm; height: 63mm;
    break-inside: avoid;
  }
  .name { margin: 0; font-size: 12pt; font-weight: 700; }
  .meta { margin: 1mm 0 4mm; font-size: 9pt; color: #71706F; }
  .label { margin: 0; font-size: 8pt; letter-spacing: .1em; text-transform: uppercase; color: #71706F; }
  .token { margin: 1mm 0 3mm; font-family: "Courier New", monospace; font-size: 20pt; font-weight: 700; letter-spacing: .18em; }
  .url { margin: 0; font-size: 8pt; color: #71706F; word-break: break-all; }
  .qr { width: 30mm; height: 30mm; }
</style>
</head>
<body>
  <div class="sheet">${cardHtml}</div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
    printWindow.document.close();
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-6">
      <h2 className="font-display text-xl font-bold">Token Pemilih</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Token hanya ditampilkan sekali. Unduh CSV atau cetak kartunya sebelum menutup halaman ini —
        yang tersimpan di server hanya sidik hash-nya.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive bg-background p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={() => generate("pending")}
          disabled={isPending || withoutToken === 0}
          className="h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {isPending ? "Membuat token..." : `Buat Token (${withoutToken} belum punya)`}
        </button>
        <button
          onClick={() => generate("all")}
          disabled={isPending || voters.length === 0}
          className="h-11 rounded-full border border-border bg-background px-5 font-semibold hover:bg-muted disabled:opacity-60"
        >
          Buat Ulang Semua Token
        </button>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Membuat ulang token akan menghanguskan token lama yang belum dipakai. Pemilih yang sudah
        mencoblos tidak ikut diproses.
      </p>

      {tokens.length > 0 && (
        <div className="mt-6 space-y-4 rounded-2xl border border-warning bg-background p-5">
          <div>
            <p className="font-semibold text-warning">
              {tokens.length} token berhasil dibuat — tampil sekali saja
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Simpan berkasnya di tempat aman. Kalau hilang, satu-satunya jalan adalah membuat token
              baru.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={downloadCsv}
              className="h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Unduh CSV
            </button>
            <button
              onClick={printCards}
              className="h-11 rounded-full border border-border bg-background px-5 font-semibold hover:bg-muted"
            >
              Cetak Kartu Token (PDF)
            </button>
          </div>

          <div className="max-h-64 overflow-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Identitas</th>
                  <th className="p-3">Nama</th>
                  <th className="p-3">Token</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.voterId} className="border-t border-border/60">
                    <td className="p-3 font-mono">{token.identifier}</td>
                    <td className="p-3">{token.name}</td>
                    <td className="p-3 font-mono text-base tracking-[0.2em]">{token.token}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
