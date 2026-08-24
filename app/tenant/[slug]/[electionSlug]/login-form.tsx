"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyToken } from "@/app/actions/vote";
import { TokenInput } from "./token-input";
import { electionBooth, electionAlreadyVoted } from "@/lib/routes";

export function LoginForm({ electionId, electionSlug }: { electionId: string; electionSlug: string }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await verifyToken({ electionId, token });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const dest = result.data.redirectTo === "bilik" 
        ? electionBooth(electionSlug) 
        : electionAlreadyVoted(electionSlug);
      router.push(dest);
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-destructive bg-background p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <TokenInput
        value={token}
        onChange={setToken}
        disabled={isPending}
        autoFocus
      />

      <button
        onClick={submit}
        disabled={token.length < 8 || isPending}
        className="w-full h-14 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {isPending ? "Memverifikasi..." : "Masuk Bilik Suara"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Masukkan 8 karakter token yang tertera di kartu pemilih Anda.
      </p>
    </div>
  );
}
