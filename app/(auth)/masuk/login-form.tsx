"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signInAction } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function isSafeNext(value: string): boolean {
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    try {
      const url = new URL(value);
      const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
      const rootHost = root.split(":")[0];
      return url.host.endsWith(`.${rootHost}`) || url.host === rootHost;
    } catch {
      return false;
    }
  }

  async function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await signInAction({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (next && isSafeNext(next)) {
        window.location.href = next;
        return;
      }

      window.location.href = result.data.redirectTo;
    });
  }

  return (
    <form action={submit} className="space-y-5">
      {error && <div className="rounded-xl border border-destructive bg-background p-4 text-sm text-destructive">{error}</div>}
      <div>
        <label htmlFor="email" className="text-sm font-semibold">Email panitia</label>
        <input id="email" name="email" type="email" required className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-semibold">Kata sandi</label>
        <input id="password" name="password" type="password" required className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <button disabled={isPending} className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
        {isPending ? "Memproses..." : "Masuk"}
      </button>
      <div className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
        <Link href="/lupa-sandi" className="font-semibold text-primary">Lupa kata sandi?</Link>
        <p>Belum punya akun panitia? <a href="mailto:hello@ayopilih.id" className="font-semibold text-primary">Hubungi kami untuk mendaftarkan organisasimu</a></p>
      </div>
    </form>
  );
}
