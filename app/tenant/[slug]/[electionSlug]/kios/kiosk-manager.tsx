"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KioskShell } from "./kiosk-shell";
import { TokenInput } from "../token-input";
import { verifyKioskToken } from "@/app/actions/kiosk_vote";
import { submitVote, clearBoothSession } from "@/app/actions/vote";
import { verifyKioskPin } from "@/app/actions/kiosk";
import { tenantHome } from "@/lib/routes";
import type { Candidate } from "@/types";

export function KioskManager({
  electionId,
  electionTitle,
  candidates,
  allowAbstain,
}: {
  electionId: string;
  electionTitle: string;
  candidates: Candidate[];
  allowAbstain: boolean;
  electionSlug: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "vote" | "confirm" | "done" | "already-voted">("login");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Voting state
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState("");
  const [countdown, setCountdown] = useState(5);

  // Exit PIN state
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  // 1. Blokir navigasi browser (SECURITY.md §10)
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // 2. Auto-reset countdown setelah voting selesai
  useEffect(() => {
    if (step !== "done") return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          resetKiosk();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  function resetKiosk() {
    startTransition(async () => {
      await clearBoothSession();
      setToken("");
      setSelectedCandidateId(null);
      setReceipt("");
      setCountdown(5);
      setError("");
      setStep("login");
    });
  }

  function handleVerifyToken() {
    setError("");
    startTransition(async () => {
      const result = await verifyKioskToken({ electionId, token });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data.redirectTo === "sudah-memilih") {
        setStep("already-voted");
        setTimeout(() => {
          resetKiosk();
        }, 5000);
      } else {
        setStep("vote");
      }
    });
  }

  function handleVoteSubmit() {
    setError("");
    startTransition(async () => {
      const result = await submitVote({
        electionId,
        candidateId: selectedCandidateId,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setReceipt(result.data.receipt);
      setStep("done");
    });
  }

  function handleExitKiosk() {
    setPinError("");
    startTransition(async () => {
      const result = await verifyKioskPin({ electionId, pin });
      if (!result.ok) {
        setPinError(result.error);
        return;
      }
      // Hapus sesi booth saat ini jika ada
      await clearBoothSession();
      // Redirect ke home tenant
      router.push(tenantHome());
    });
  }

  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId);

  return (
    <KioskShell>
      <div className="w-full text-center space-y-8">
        {/* Tombol Keluar Kios di Pojok Kanan Atas */}
        <div className="absolute top-4 right-4 z-50">
          <button
            type="button"
            onClick={() => {
              setPin("");
              setPinError("");
              setShowExitDialog(true);
            }}
            className="h-10 px-4 rounded-full border border-background/20 bg-black/40 hover:bg-black/60 font-mono text-xs uppercase tracking-wider text-background/60 hover:text-background"
          >
            Keluar Kios
          </button>
        </div>

        {/* STEP 1: LOGIN TOKEN */}
        {step === "login" && (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="space-y-2">
              <h1 className="font-display text-3xl font-extrabold text-background">{electionTitle}</h1>
              <p className="text-background/60">Silakan masukkan 8 karakter Token Pemilih Anda untuk mencoblos.</p>
            </div>

            {error && (
              <div className="rounded-2xl border border-destructive bg-foreground p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <TokenInput value={token} onChange={setToken} disabled={isPending} autoFocus />

            <button
              onClick={handleVerifyToken}
              disabled={token.length < 8 || isPending}
              className="w-full h-14 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60 text-lg"
            >
              {isPending ? "Memverifikasi..." : "Mulai Memilih"}
            </button>
          </div>
        )}

        {/* STEP 2: BILIK SUARA KIOS */}
        {step === "vote" && (
          <div className="space-y-6 w-full text-left">
            <div className="text-center space-y-2 mb-6">
              <h2 className="font-display text-2xl font-bold text-background">Bilik Suara Kios</h2>
              <p className="text-background/60 text-sm">Pilih salah satu pasangan calon di bawah ini.</p>
            </div>

            {error && (
              <div className="rounded-2xl border border-destructive bg-foreground p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => setSelectedCandidateId(candidate.id)}
                  disabled={isPending}
                  className={`flex flex-col rounded-3xl border-2 p-6 text-left relative overflow-hidden transition min-h-[140px] ${
                    selectedCandidateId === candidate.id
                      ? "border-primary bg-primary/10"
                      : "border-background/20 bg-black hover:border-primary/50"
                  }`}
                >
                  <span className="absolute -top-3 -right-3 font-display text-6xl font-black text-background/10 select-none">
                    {candidate.candidate_number}
                  </span>
                  <span className="font-display text-2xl font-black text-primary/80 mb-2">
                    {candidate.candidate_number}
                  </span>
                  <span className="font-semibold text-lg text-background block">{candidate.name}</span>
                  {candidate.running_mate && (
                    <span className="text-sm text-background/60 mt-1 block">Wakil: {candidate.running_mate}</span>
                  )}
                </button>
              ))}

              {allowAbstain && (
                <button
                  onClick={() => setSelectedCandidateId(null)}
                  disabled={isPending}
                  className={`flex flex-col rounded-3xl border-2 p-6 text-left relative overflow-hidden transition min-h-[140px] ${
                    selectedCandidateId === null
                      ? "border-primary bg-primary/10"
                      : "border-background/20 bg-black hover:border-primary/50"
                  }`}
                >
                  <span className="font-semibold text-lg text-background block mt-auto">Abstain (Kotak Kosong)</span>
                  <span className="text-sm text-background/60 mt-1 block">Tidak memilih kandidat manapun.</span>
                </button>
              )}
            </div>

            <div className="pt-6">
              <button
                onClick={() => setStep("confirm")}
                disabled={selectedCandidateId === undefined || isPending}
                className="w-full h-14 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60 text-lg"
              >
                Lanjut ke Konfirmasi
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: KONFIRMASI PILIHAN */}
        {step === "confirm" && (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-bold text-background">Konfirmasi Pilihan Anda</h2>
              <p className="text-background/60">Pastikan pilihan Anda sudah benar sebelum mengirimkan suara.</p>
            </div>

            <div className="rounded-3xl border border-background/20 bg-black p-6 space-y-4">
              {selectedCandidateId === null ? (
                <div className="text-center py-4">
                  <span className="text-xl font-bold text-primary block">Abstain</span>
                  <span className="text-sm text-background/60 mt-1 block">Anda memilih kotak kosong (abstain)</span>
                </div>
              ) : (
                selectedCandidate && (
                  <div className="text-center py-4 space-y-2">
                    <span className="font-display text-5xl font-black text-primary block">
                      {selectedCandidate.candidate_number}
                    </span>
                    <span className="text-xl font-bold text-background block">{selectedCandidate.name}</span>
                    {selectedCandidate.running_mate && (
                      <span className="text-sm text-background/60 block">Wakil: {selectedCandidate.running_mate}</span>
                    )}
                  </div>
                )
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep("vote")}
                disabled={isPending}
                className="flex-1 h-14 rounded-full border border-background/20 bg-black hover:bg-black/60 font-semibold text-background disabled:opacity-60"
              >
                Ubah Pilihan
              </button>
              <button
                onClick={handleVoteSubmit}
                disabled={isPending}
                className="flex-1 h-14 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {isPending ? "Mengirim..." : "Kirim Suara"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SELESAI */}
        {step === "done" && (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="space-y-4">
              <div className="mx-auto h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-4xl">
                ✓
              </div>
              <h2 className="font-display text-3xl font-extrabold text-background">Suara Berhasil Dikirim</h2>
              <p className="text-background/60">Terima kasih atas partisipasi Anda.</p>
            </div>

            <div className="rounded-3xl border border-background/20 bg-black p-6 space-y-4">
              <span className="text-sm text-background/40 font-mono block">KODE BUKTI PEMILIHAN</span>
              <span className="font-mono text-3xl font-bold text-background tracking-widest block">{receipt}</span>
              <p className="text-xs text-background/40">Silakan catat kode di atas untuk memverifikasi keabsahan suara Anda di kemudian hari.</p>
            </div>

            <div className="pt-6 font-mono text-sm text-background/60 animate-pulse">
              Layar akan otomatis direset dalam <span className="font-bold text-primary">{countdown} detik</span>.
            </div>
          </div>
        )}

        {/* STEP 5: ALREADY VOTED WARNING */}
        {step === "already-voted" && (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="space-y-4">
              <div className="mx-auto h-20 w-20 rounded-full bg-destructive/20 flex items-center justify-center text-destructive text-4xl">
                ✕
              </div>
              <h2 className="font-display text-3xl font-extrabold text-background">Token Sudah Digunakan</h2>
              <p className="text-background/60">Token pemilih ini telah digunakan sebelumnya. Setiap orang hanya diperbolehkan memilih satu kali.</p>
            </div>

            <div className="pt-6 font-mono text-sm text-background/60 animate-pulse">
              Layar akan otomatis direset dalam <span className="font-bold text-primary">5 detik</span>.
            </div>
          </div>
        )}

        {/* EXIT PIN DIALOG */}
        {showExitDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-md rounded-3xl border border-background/10 bg-foreground text-background p-6 space-y-6">
              <div className="space-y-2 text-center">
                <h3 className="font-display text-xl font-bold">Verifikasi PIN Panitia</h3>
                <p className="text-background/60 text-sm">Masukkan 6 digit PIN Kios untuk keluar dari mode ini.</p>
              </div>

              {pinError && (
                <div className="rounded-2xl border border-destructive bg-foreground p-3 text-xs text-destructive text-center">
                  {pinError}
                </div>
              )}

              <input
                type="password"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={isPending}
                className="h-14 w-full rounded-2xl border-2 border-background/20 bg-black text-center font-mono text-2xl font-bold tracking-widest outline-none focus:border-primary disabled:opacity-60 text-background"
                placeholder="******"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitDialog(false)}
                  disabled={isPending}
                  className="flex-1 h-12 rounded-full border border-background/20 bg-black hover:bg-black/60 font-semibold disabled:opacity-60"
                >
                  Kembali
                </button>
                <button
                  onClick={handleExitKiosk}
                  disabled={pin.length < 6 || isPending}
                  className="flex-1 h-12 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
                >
                  {isPending ? "Keluar..." : "Verifikasi"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </KioskShell>
  );
}
