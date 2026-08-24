"use client";

import { useState, useTransition } from "react";
import { exportRekapSuara, exportDaftarHadir, exportAuditLog, generateBeritaAcaraPdf, sendVoterTokens, regenerateVoterToken, searchVoters } from "@/app/actions/report";
import { toast } from "sonner";
import { Download, Send, FileText, Shield, Loader2, Mail, MessageSquare, Lock, AlertTriangle } from "lucide-react";
import type { PlanType } from "@/types";
import type { PlanLimit } from "@/lib/plans";

interface LaporanClientPanelProps {
  electionId: string;
  plan: PlanType;
  limits: PlanLimit;
  hasResend: boolean;
  hasFonnte: boolean;
  turnout: { total_voters: number; voted: number };
  liveCount: { candidate_number: number; name: string; total: number }[];
}

export function LaporanClientPanel({
  electionId,
  limits,
  hasResend,
  hasFonnte,
  turnout,
  liveCount,
}: LaporanClientPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [confirmSend, setConfirmSend] = useState<"email" | "whatsapp" | "both" | null>(null);

  function downloadBlob(content: BlobPart, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportCsv(action: "rekap" | "hadir" | "audit") {
    startTransition(async () => {
      let result: { ok: boolean; data?: { csv: string; filename: string }; error?: string } = { ok: false };
      if (action === "rekap") {
        result = await exportRekapSuara({ electionId });
      } else if (action === "hadir") {
        result = await exportDaftarHadir({ electionId });
      } else {
        result = await exportAuditLog({ electionId });
      }
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Gagal mengekspor CSV.");
        return;
      }
      downloadBlob(result.data.csv, result.data.filename, "text/csv");
      toast.success(
        action === "rekap" ? "Rekap Suara" : action === "hadir" ? "Daftar Hadir" : "Audit Log" + " berhasil diunduh."
      );
    });
  }

  function handleExportPdf() {
    setPdfGenerating(true);
    startTransition(async () => {
      const result = await generateBeritaAcaraPdf({ electionId });
      setPdfGenerating(false);
      if (!result.ok) {
        toast.error(result.error ?? "Gagal membuat PDF.");
        return;
      }
      if (!result.data) {
        toast.error("Data PDF tidak valid.");
        return;
      }
      const byteCharacters = atob(result.data.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Berita acara PDF berhasil diunduh.");
    });
  }

  function handleConfirmSend() {
    if (!confirmSend) return;
    const channel = confirmSend;
    startTransition(async () => {
      const result = await sendVoterTokens({ electionId, channel });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal mengirim undangan.");
        setConfirmSend(null);
        return;
      }
      if (!result.data) {
        toast.error("Data respons tidak valid.");
        setConfirmSend(null);
        return;
      }
      const { sent, failed, details } = result.data;
      toast.success(`Undangan terkirim: ${sent} berhasil, ${failed} gagal.`);
      if (details && details.length > 0) {
        console.log("Send details:", details);
      }
      setConfirmSend(null);
    });
  }

  async function handleRegenerateToken(voterId: string, voterName: string) {
    const confirmed = window.confirm(
      `Token Baru untuk ${voterName}?\n\nToken lama akan HANGUS dan tidak bisa dipakai lagi.\nPemilih WAJIB diberi tahu tentang token baru ini.\n\nAksi ini TIDAK DAPAT DIBATALKAN.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await regenerateVoterToken({ electionId, voterId });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal membuat token baru.");
        return;
      }
      if (!result.data) {
        toast.error("Data respons tidak valid.");
        return;
      }
      const { token } = result.data;
      navigator.clipboard.writeText(token);
      toast.success(
        `Token baru untuk ${voterName}: ${token} (disalin ke clipboard).`,
        { duration: 10000 }
      );
    });
  }

  const canPdf = limits.pdfReport;
  const canEmail = limits.email && hasResend;
  const canWhatsApp = limits.whatsapp && hasFonnte;
  const canSend = canEmail || canWhatsApp;

  const sendChannelLabel = (() => {
    switch (confirmSend) {
      case "email":
        return "Email";
      case "whatsapp":
        return "WhatsApp";
      case "both":
        return "Email & WhatsApp";
      default:
        return "";
    }
  })();

  return (
    <div className="space-y-8">
      {/* Ringkasan */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Ringkasan Pemilihan
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-border bg-background p-4 text-center">
            <p className="text-sm text-muted-foreground">Total DPT</p>
            <p className="mt-2 font-display text-2xl font-bold">{turnout.total_voters}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4 text-center">
            <p className="text-sm text-muted-foreground">Sudah Memilih</p>
            <p className="mt-2 font-display text-2xl font-bold text-success">{turnout.voted}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4 text-center">
            <p className="text-sm text-muted-foreground">Partisipasi</p>
            <p className="mt-2 font-display text-2xl font-bold">
              {turnout.total_voters > 0 ? ((turnout.voted / turnout.total_voters) * 100).toFixed(2) : 0}%
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4 text-center">
            <p className="text-sm text-muted-foreground">Paket</p>
            <p className="mt-2 font-display text-2xl font-bold">{limits.label}</p>
          </div>
        </div>
      </section>

      {/* Ekspor CSV */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Ekspor CSV
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => handleExportCsv("rekap")}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Rekap Suara per Paslon
          </button>
          <button
            onClick={() => handleExportCsv("hadir")}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 h-11 rounded-full border border-border bg-background px-5 font-semibold hover:bg-muted disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Daftar Hadir (Nama & Waktu)
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Audit Log (CSV)</span>
            </div>
            <button
              onClick={() => handleExportCsv("audit")}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 h-10 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60"
            >
              Unduh Audit Log
            </button>
          </div>
        </div>
      </section>

      {/* Berita Acara PDF */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Berita Acara (PDF)
        </h2>
        <div className="mt-5">
          {canPdf ? (
            <button
              onClick={handleExportPdf}
              disabled={isPending || pdfGenerating}
              className="inline-flex items-center justify-center gap-2 h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {pdfGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menghasilkan PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Unduh Berita Acara PDF
                </>
              )}
            </button>
          ) : (
            <div className="rounded-xl border border-warning bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-warning">Fitur terkunci di paket Starter</p>
                  <p className="text-sm text-muted-foreground">
                    Ekspor PDF berita acara dengan kop tenant, tanda tangan panitia, dan format siap cetak hanya tersedia
                    di paket Pro. Naik paket untuk membuka fitur ini.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Undangan ke Pemilih */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Undangan ke Pemilih
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Kirim undangan via Email dan/atau WhatsApp. Token yang sudah diberikan tidak akan berubah, hanya tautan masuk yang dikirim ulang.
          Token baru untuk pemilih yang belum memiliki token akan dibuat otomatis.
        </p>

        {canSend ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {canEmail && (
              <button
                onClick={() => setConfirmSend("email")}
                disabled={isPending}
                className="flex flex-col items-center gap-2 p-4 h-auto rounded-xl border border-border bg-background hover:border-primary/40 disabled:opacity-60"
              >
                <Mail className="h-6 w-6 text-primary" />
                <span className="font-medium">Kirim Email</span>
                <span className="text-xs text-muted-foreground">via Resend</span>
              </button>
            )}
            {canWhatsApp && (
              <button
                onClick={() => setConfirmSend("whatsapp")}
                disabled={isPending}
                className="flex flex-col items-center gap-2 p-4 h-auto rounded-xl border border-border bg-background hover:border-primary/40 disabled:opacity-60"
              >
                <MessageSquare className="h-6 w-6 text-green-600" />
                <span className="font-medium">Kirim WhatsApp</span>
                <span className="text-xs text-muted-foreground">via Fonnte</span>
              </button>
            )}
            {canEmail && canWhatsApp && (
              <button
                onClick={() => setConfirmSend("both")}
                disabled={isPending}
                className="flex flex-col items-center gap-2 p-4 h-auto rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                <Send className="h-6 w-6" />
                <span className="font-medium">Kirim Keduanya</span>
                <span className="text-xs opacity-90">Email + WhatsApp</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-muted bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Fitur terkunci</p>
                <p className="text-sm text-muted-foreground">
                  {!canEmail && !canWhatsApp
                    ? `Paket ${limits.label} tidak mendukung pengiriman token. Naik ke paket Pro untuk membuka fitur ini.`
                    : `Konfigurasi server (RESEND_API_KEY / FONNTE_TOKEN) belum disetel. Tambahkan di .env.local untuk mengaktifkan.`}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Token Darurat (Generate Ulang) */}
      <section className="rounded-3xl border border-destructive/40 bg-card p-6">
        <h2 className="font-display text-xl font-bold flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Generate Ulang Token (Aksi Destruktif)
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Token yang sudah diberikan akan <strong>HANGUS</strong> jika Anda generate ulang. Pemilih WAJIB diberi tahu tentang token baru.
          Gunakan hanya dalam kondisi darurat (misal: token hilang atau bocor).
        </p>
        <RegenerateTokenForm
          electionId={electionId}
          onRegenerate={handleRegenerateToken}
          isPending={isPending}
        />
      </section>

      {/* Preview hasil */}
      {liveCount.length > 0 && (
        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Preview Perolehan Suara
          </h2>
          <div className="mt-5 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3 font-semibold">No. Urut</th>
                  <th className="text-left p-3 font-semibold">Nama Paslon</th>
                  <th className="text-right p-3 font-semibold">Suara</th>
                </tr>
              </thead>
              <tbody>
                {liveCount.map((item) => (
                  <tr key={item.candidate_number} className="border-t border-border/50">
                    <td className="p-3 text-center font-display font-bold text-primary">{item.candidate_number}</td>
                    <td className="p-3">{item.name}</td>
                    <td className="p-3 text-right font-mono font-semibold">{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Confirm Send Modal */}
      {confirmSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6">
            <h3 className="font-display text-xl font-bold">Kirim undangan via {sendChannelLabel}?</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Undangan ini berisi <strong>tautan masuk</strong> ke bilik suara. Token yang sudah diberikan kepada pemilih TETAP BERLAKU dan tidak akan berubah.
              <br /><br />
              Untuk pemilih yang belum memiliki token, sistem akan membuat token baru secara otomatis.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmSend(null)}
                disabled={isPending}
                className="h-11 flex-1 rounded-full border border-border bg-background font-semibold disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmSend}
                disabled={isPending}
                className="h-11 flex-1 rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-60"
              >
                {isPending ? "Mengirim..." : `Ya, Kirim Undangan ${sendChannelLabel}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RegenerateTokenForm({
  electionId,
  onRegenerate,
  isPending,
}: {
  electionId: string;
  onRegenerate: (voterId: string, voterName: string) => void;
  isPending: boolean;
}) {
  const [voterIdentifier, setVoterIdentifier] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string; identifier: string; has_voted: boolean; status: string }>>([]);

  async function handleSearch() {
    if (!voterIdentifier.trim()) {
      toast.error("Masukkan identifier (NISN/NIM/NIK) atau nama pemilih.");
      return;
    }
    setSearching(true);
    try {
      const result = await searchVoters({ electionId, query: voterIdentifier.trim() });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal mencari pemilih.");
        setCandidates([]);
        return;
      }
      setCandidates(result.data);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={voterIdentifier}
          onChange={(e) => setVoterIdentifier(e.target.value)}
          placeholder="Cari identifier (NISN/NIM/NIK) atau nama..."
          disabled={searching || isPending}
          className="flex-1 h-10 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
        <button
          onClick={handleSearch}
          disabled={searching || isPending}
          className="h-10 rounded-full border border-border bg-background px-5 text-sm font-semibold hover:bg-muted disabled:opacity-60"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cari"}
        </button>
      </div>

      {candidates.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-destructive/10 border-b border-destructive/30">
                <th className="text-left p-3 font-semibold">Identitas</th>
                <th className="text-left p-3 font-semibold">Nama</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-left p-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b border-border/30">
                  <td className="p-3 font-mono text-xs">{c.identifier}</td>
                  <td className="p-3">{c.name}</td>
                  <td className="p-3">
                    {c.has_voted ? (
                      <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                        SUDAH MEMILIH
                      </span>
                    ) : (
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${c.status === "BLOCKED" ? "bg-destructive/10 text-destructive" : "bg-info/10 text-info"}`}>
                        {c.status}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {c.has_voted ? (
                      <span className="text-xs text-muted-foreground">Tidak bisa generate baru</span>
                    ) : (
                      <button
                        onClick={() => onRegenerate(c.id, c.name)}
                        disabled={isPending}
                        className="h-8 rounded-full border border-destructive px-3 text-xs font-semibold text-destructive hover:bg-destructive hover:text-primary-foreground disabled:opacity-60"
                      >
                        Generate Token Baru
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}