"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateElection } from "@/app/actions/election";
import type { Election, VotingMode } from "@/types";

type TimeZone = "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura";

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function EditElectionForm({
  election,
  locked,
}: {
  election: Election;
  locked: boolean;
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const input = locked
        ? {
            show_candidates_before_login: formData.get("show_candidates_before_login") === "on",
            show_public_result: formData.get("show_public_result") === "on",
          }
        : {
            title: String(formData.get("title") ?? ""),
            slug: String(formData.get("slug") ?? ""),
            subtitle: String(formData.get("subtitle") ?? ""),
            description: String(formData.get("description") ?? ""),
            voting_mode: String(formData.get("voting_mode") ?? "ONLINE_ONLY") as VotingMode,
            kiosk_pin: String(formData.get("kiosk_pin") ?? ""),
            start_time: String(formData.get("start_time") ?? ""),
            end_time: String(formData.get("end_time") ?? ""),
            time_zone: String(formData.get("time_zone") ?? "Asia/Jakarta") as TimeZone,
            allow_abstain: formData.get("allow_abstain") === "on",
            show_candidates_before_login: formData.get("show_candidates_before_login") === "on",
            show_public_result: formData.get("show_public_result") === "on",
          };

      const result = await updateElection(election.id, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Perubahan tersimpan.");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-5 rounded-3xl border border-border bg-card p-6">
      <h2 className="font-display text-xl font-bold">Ubah Pemilihan</h2>

      {locked && (
        <p className="rounded-xl border border-info bg-background p-4 text-sm text-muted-foreground">
          Suara sudah masuk. Judul, jadwal, dan mode voting dikunci; hanya pengaturan tampilan yang
          masih bisa diubah.
        </p>
      )}
      {error && (
        <div className="rounded-xl border border-destructive bg-background p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-border bg-background p-4 text-sm text-success">
          {message}
        </div>
      )}

      {!locked && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Judul" name="title" defaultValue={election.title} />
            <Field label="Slug" name="slug" defaultValue={election.slug} />
          </div>
          <Field
            label="Subjudul"
            name="subtitle"
            required={false}
            defaultValue={election.subtitle ?? ""}
          />
          <div>
            <label className="text-sm font-semibold" htmlFor="description">
              Deskripsi
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={election.description ?? ""}
              className="mt-2 min-h-28 w-full rounded-2xl border border-border bg-background p-4 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Mode voting"
              name="voting_mode"
              defaultValue={election.voting_mode}
              options={["ONLINE_ONLY", "OFFLINE_TPS", "HYBRID"]}
            />
            <Select
              label="Zona waktu"
              name="time_zone"
              defaultValue="Asia/Jakarta"
              options={["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="PIN Kios Baru (6 digit angka)"
              name="kiosk_pin"
              required={false}
              placeholder="Kosongkan jika tidak ingin mengubah"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Mulai"
              name="start_time"
              type="datetime-local"
              defaultValue={toLocalInput(election.start_time)}
            />
            <Field
              label="Selesai"
              name="end_time"
              type="datetime-local"
              defaultValue={toLocalInput(election.end_time)}
            />
          </div>
          <Check name="allow_abstain" label="Izinkan abstain" defaultChecked={election.allow_abstain} />
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Check
          name="show_candidates_before_login"
          label="Tampilkan paslon sebelum login"
          defaultChecked={election.show_candidates_before_login}
        />
        <Check
          name="show_public_result"
          label="Hasil publik"
          defaultChecked={election.show_public_result}
        />
      </div>

      <button
        disabled={isPending}
        className="h-12 rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Simpan Perubahan"}
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
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
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
        placeholder={placeholder}
        className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-semibold">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function Check({
  name,
  label,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-background p-4 text-sm font-semibold">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}
