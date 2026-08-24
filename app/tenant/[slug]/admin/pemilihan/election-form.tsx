"use client";

import { useState, useTransition } from "react";
import { createElection } from "@/app/actions/election";
import { slugify } from "@/lib/utils";

export function ElectionForm({ tenantId }: { tenantId: string }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await createElection(tenantId, {
        title,
        slug,
        subtitle: String(formData.get("subtitle") ?? ""),
        description: String(formData.get("description") ?? ""),
        voting_mode: String(formData.get("voting_mode") ?? "ONLINE_ONLY") as "ONLINE_ONLY" | "OFFLINE_TPS" | "HYBRID",
        kiosk_pin: String(formData.get("kiosk_pin") ?? ""),
        start_time: String(formData.get("start_time") ?? ""),
        end_time: String(formData.get("end_time") ?? ""),
        time_zone: String(formData.get("time_zone") ?? "Asia/Jakarta") as "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura",
        allow_abstain: formData.get("allow_abstain") === "on",
        show_candidates_before_login: formData.get("show_candidates_before_login") === "on",
        show_public_result: formData.get("show_public_result") === "on",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Pemilihan berhasil dibuat.");
    });
  }

  return (
    <form action={submit} className="space-y-5 rounded-3xl border border-border bg-card p-6">
      {error && <div className="rounded-xl border border-destructive bg-background p-4 text-sm text-destructive">{error}</div>}
      {message && <div className="rounded-xl border border-border bg-background p-4 text-sm text-success">{message}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Judul" name="title" value={title} onChange={(value) => { setTitle(value); if (!slug) setSlug(slugify(value)); }} />
        <Field label="Slug" name="slug" value={slug} onChange={(value) => setSlug(slugify(value))} />
      </div>
      <Field label="Subjudul" name="subtitle" required={false} />
      <div>
        <label className="text-sm font-semibold" htmlFor="description">Deskripsi</label>
        <textarea id="description" name="description" className="mt-2 min-h-28 w-full rounded-2xl border border-border bg-background p-4 outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Mode voting" name="voting_mode" options={["ONLINE_ONLY", "OFFLINE_TPS", "HYBRID"]} />
        <Select label="Zona waktu" name="time_zone" options={["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]} />
        <Field label="PIN Kios (6 digit)" name="kiosk_pin" required={false} placeholder="6 digit angka" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mulai" name="start_time" type="datetime-local" />
        <Field label="Selesai" name="end_time" type="datetime-local" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Check name="allow_abstain" label="Izinkan abstain" />
        <Check name="show_candidates_before_login" label="Tampilkan paslon sebelum login" defaultChecked />
        <Check name="show_public_result" label="Hasil publik" />
      </div>
      <button disabled={isPending} className="h-12 rounded-full bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-60">{isPending ? "Menyimpan..." : "Buat Pemilihan"}</button>
    </form>
  );
}

function Field({ label, name, type = "text", required = true, value, onChange, placeholder }: { label: string; name: string; type?: string; required?: boolean; value?: string; onChange?: (value: string) => void; placeholder?: string }) {
  return <div><label htmlFor={name} className="text-sm font-semibold">{label}</label><input id={name} name={name} type={type} required={required} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} placeholder={placeholder} className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring" /></div>;
}

function Select({ label, name, options }: { label: string; name: string; options: string[] }) {
  return <div><label htmlFor={name} className="text-sm font-semibold">{label}</label><select id={name} name={name} className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>;
}

function Check({ name, label, defaultChecked = false }: { name: string; label: string; defaultChecked?: boolean }) {
  return <label className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-sm font-semibold"><input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4" />{label}</label>;
}
