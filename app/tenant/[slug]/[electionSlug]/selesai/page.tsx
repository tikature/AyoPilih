"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { electionHome } from "@/lib/routes";

export default function ReceiptPage({
  params,
}: {
  params: Promise<{ slug: string; electionSlug: string }>;
}) {
  const searchParams = useSearchParams();
  const receipt = searchParams.get("receipt");
  const [timeLeft, setTimeLeft] = useState(600); // 10 menit
  const { electionSlug } = use(params);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <main className="min-h-dvh bg-background px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <p className="text-6xl">✓</p>
          <div>
            <h1 className="font-display text-3xl font-bold">Suara Anda Terkirim</h1>
            <p className="mt-2 text-muted-foreground">Terima kasih sudah berpartisipasi</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
          <p className="text-center text-sm text-muted-foreground">Kode Bukti Pemilihan</p>
          {receipt && (
            <div className="rounded-2xl bg-muted p-4 text-center space-y-2">
              <p className="font-mono text-2xl font-bold tracking-widest">{receipt}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(receipt);
                }}
                className="w-full mt-3 h-10 rounded-full border border-border bg-background text-sm font-semibold hover:bg-muted"
              >
                Salin Kode
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Simpan kode ini. Anda bisa mengecek suara Anda tercatat di halaman verifikasi hasil dengan kode ini.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4 text-center">
          <p className="text-sm text-muted-foreground">Sesi Anda berakhir dalam:</p>
          <p className="mt-2 font-mono text-2xl font-bold">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </p>
        </div>

        <Link
          href={electionHome(electionSlug)}
          className="block rounded-full bg-primary py-4 text-center font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Kembali ke Halaman Pemilihan
        </Link>

        <p className="text-center text-xs text-muted-foreground">
          Didukung oleh AyoPilih
        </p>
      </div>
    </main>
  );
}
