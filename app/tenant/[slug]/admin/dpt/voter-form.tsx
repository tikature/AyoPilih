"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVoter, updateVoter } from "@/app/actions/voters";
import type { Voter } from "@/types";

export function VoterForm({ electionId, voter }: { electionId: string; voter?: Voter }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const input = {
        identifier: String(formData.get("identifier") ?? ""),
        name: String(formData.get("name") ?? ""),
        group_name: String(formData.get("group_name") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
      };

      const result = voter
        ? await updateVoter(voter.id, input)
        : await createVoter({ electionId, ...input });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/admin/dpt?election=${electionId}`);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-5 rounded-3xl border border-border bg-card p-6">
      {error && (
        <div className="rounded-xl border border-destructive bg-background p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Identitas (NISN/NIM/NIK)" name="identifier" defaultValue={voter?.identifier ?? ""} />
        <Field label="Nama lengkap" name="name" defaultValue={voter?.name ?? ""} />
      </div>
      <Field
        label="Kelas/Prodi"
        name="group_name"
        required={false}
        defaultValue={voter?.group_name ?? ""}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Email"
          name="email"
          type="email"
          required={false}
          defaultValue={voter?.email ?? ""}
        />
        <Field label="Nomor HP" name="phone" required={false} defaultValue={voter?.phone ?? ""} />
      </div>
      <button
        disabled={isPending}
        className="h-12 rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : voter ? "Simpan Perubahan" : "Tambah Pemilih"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
