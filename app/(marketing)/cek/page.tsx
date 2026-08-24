"use client";

import { useState, useTransition } from "react";
import { verifyReceipt } from "@/app/actions/vote";

export default function VerificationPage() {
  const [receipt, setReceipt] = useState("");
  const [result, setResult] = useState<{
    recorded: boolean;
    electionTitle?: string;
    recordedAt?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);

    startTransition(async () => {
      const res = await verifyReceipt({ receipt });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data);
    });
  }

  return (
    <main className="min-h-dvh bg-muted px-4 py-20">
      <div className="mx-auto max-w-md space-y-8">
        <div className="text-center space-y-3">
          <h1 className="font-display text-3xl font-bold">Verifikasi Suara</h1>
          <p className="text-muted-foreground">
            Masukkan kode bukti Anda untuk memverifikasi bahwa suara telah tercatat di server.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4 rounded-3xl border border-border bg-card p-6">
          {error && (
            <div className="rounded-xl border border-destructive bg-background p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="receipt" className="text-sm font-semibold">
              Kode Bukti Pemilihan
            </label>
            <input
              id="receipt"
              name="receipt"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value.toUpperCase())}
              placeholder="AYP-XXXX-XXXX-XXXX"
              required
              className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring font-mono text-center text-lg uppercase tracking-wider"
            />
          </div>

          <button
            disabled={isPending}
            className="w-full h-12 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {isPending ? "Memverifikasi..." : "Verifikasi"}
          </button>
        </form>

        {result && (
          <div className="rounded-3xl border border-border bg-card p-6 text-center space-y-4">
            {result.recorded ? (
              <>
                <p className="text-4xl">✓</p>
                <h3 className="font-display text-xl font-bold text-success">Suara Anda Tercatat!</h3>
                <div className="text-sm space-y-2 rounded-2xl bg-muted p-4">
                  <div>
                    <p className="text-muted-foreground">Pemilihan:</p>
                    <p className="font-semibold">{result.electionTitle}</p>
                  </div>
                  {result.recordedAt && (
                    <div>
                      <p className="text-muted-foreground">Waktu Masuk:</p>
                      <p className="font-mono text-xs">
                        {new Date(result.recordedAt).toLocaleString("id-ID")}
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Catatan: Pilihan Anda tetap rahasia. Halaman ini hanya menunjukkan keabsahan bahwa
                  suara dengan hash yang sesuai sudah terdaftar di database.
                </p>
              </>
            ) : (
              <>
                <p className="text-4xl">✗</p>
                <h3 className="font-display text-xl font-bold text-destructive">
                  Suara Tidak Ditemukan
                </h3>
                <p className="text-sm text-muted-foreground">
                  Pastikan kode bukti yang Anda masukkan sudah benar. Hubungi panitia jika Anda yakin
                  suara Anda sudah dikirim namun tidak terdaftar.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
