"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions/auth";

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await forgotPasswordAction({ email: String(formData.get("email") ?? "") });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-background p-4 text-sm">
          Tautan pemulihan sudah dikirim. Periksa kotak masuk dan folder spam.
        </div>
        <Link href="/masuk" className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border font-semibold">
          Kembali ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-5">
      {error && <div className="rounded-xl border border-destructive bg-background p-4 text-sm text-destructive">{error}</div>}
      <div>
        <label htmlFor="email" className="text-sm font-semibold">Email panitia</label>
        <input id="email" name="email" type="email" required className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <button disabled={isPending} className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
        {isPending ? "Mengirim..." : "Kirim Tautan Pemulihan"}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        Ingat kata sandinya? <Link href="/masuk" className="font-semibold text-primary">Masuk</Link>
      </p>
    </form>
  );
}
