"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  checkSlugAvailability,
  createTenantByAdmin,
} from "@/app/actions/auth";
import { slugify, tenantUrl } from "@/lib/utils";

export function NewTenantForm() {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugMessage, setSlugMessage] = useState("Subdomain akan dicek otomatis.");
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ slug: string; email: string } | null>(null);

  const previewUrl = slug ? tenantUrl(slug) : "namaorganisasi.ayopilih.id";

  useEffect(() => {
    if (!slug) {
      setSlugMessage("Subdomain akan dicek otomatis.");
      setIsAvailable(false);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await checkSlugAvailability(slug);
        if (cancelled) return;
        if (!result.ok) {
          setSlugMessage(result.error);
          setIsAvailable(false);
          return;
        }
        setIsAvailable(result.data.available);
        setSlugMessage(
          result.data.available
            ? "Subdomain tersedia."
            : result.data.reason ?? "Subdomain sudah dipakai.",
        );
      });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slug) setSlug(slugify(value));
  }

  async function submit(formData: FormData) {
    setError("");
    setSuccess(null);

    startTransition(async () => {
      const result = await createTenantByAdmin({
        name: String(formData.get("name") ?? ""),
        slug,
        ownerEmail: String(formData.get("ownerEmail") ?? ""),
        plan: String(formData.get("plan") ?? "STARTER") as
          | "STARTER"
          | "PRO"
          | "ENTERPRISE",
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess({ slug: result.data.tenantSlug, email: result.data.ownerEmail });
      setName("");
      setSlug("");
    });
  }

  return (
    <form action={submit} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-destructive bg-background p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-success bg-success/10 p-4 text-sm text-success">
          <p className="font-semibold">Tenant berhasil dibuat!</p>
          <p className="mt-1 text-foreground/80">
            Subdomain: <span className="font-mono font-bold">{success.slug}</span> · Undangan dikirim ke{" "}
            <span className="font-mono">{success.email}</span>
          </p>
          <p className="mt-2 text-xs">
            Pantau di <Link href="/internal/tenants" className="underline">Daftar Tenant</Link>.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="name" className="text-sm font-semibold">
          Nama organisasi
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="SMA Negeri 1 Purwokerto"
          className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label htmlFor="slug" className="text-sm font-semibold">
          Subdomain
        </label>
        <div className="mt-2 flex rounded-full border border-border bg-background px-4 focus-within:ring-2 focus-within:ring-ring">
          <input
            id="slug"
            name="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="sman1purwokerto"
            required
            className="min-h-12 flex-1 bg-transparent outline-none"
          />
          <span className="flex items-center text-sm text-muted-foreground">
            .ayopilih.id
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className={isAvailable ? "text-success" : "text-muted-foreground"}>
            {slugMessage}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{previewUrl}</p>
        </div>
      </div>

      <div>
        <label htmlFor="ownerEmail" className="text-sm font-semibold">
          Email panitia owner
        </label>
        <input
          id="ownerEmail"
          name="ownerEmail"
          type="email"
          required
          placeholder="panitia@sman1purwokerto.sch.id"
          className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Undangan untuk atur kata sandi akan dikirim ke email ini.
        </p>
      </div>

      <div>
        <label htmlFor="plan" className="text-sm font-semibold">
          Paket awal
        </label>
        <select
          id="plan"
          name="plan"
          defaultValue="STARTER"
          className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="STARTER">Starter (Gratis)</option>
          <option value="PRO">Pro (Rp 299.000 / pemilihan)</option>
          <option value="ENTERPRISE">Enterprise (Mulai Rp 2.500.000 / tahun)</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending || !isAvailable}
        className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Membuat tenant..." : "Buat Tenant & Kirim Undangan"}
      </button>
    </form>
  );
}
