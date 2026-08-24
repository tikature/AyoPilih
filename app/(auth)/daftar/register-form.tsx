"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { checkSlugAvailability, signUpWithTenant } from "@/app/actions/auth";
import { slugify, tenantUrl } from "@/lib/utils";

export function RegisterForm() {
  const [isPending, startTransition] = useTransition();
  const [tenantName, setTenantName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugMessage, setSlugMessage] = useState("Subdomain akan dicek otomatis.");
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState("");

  const previewUrl = useMemo(() => (slug ? tenantUrl(slug) : "namamu.localhost:3000"), [slug]);

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
        setSlugMessage(result.data.available ? "Subdomain tersedia." : result.data.reason ?? "Subdomain sudah dipakai.");
      });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug]);

  function handleTenantNameChange(value: string) {
    setTenantName(value);
    if (!slug) setSlug(slugify(value));
  }

  async function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await signUpWithTenant({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        fullName: String(formData.get("fullName") ?? ""),
        institution: String(formData.get("institution") ?? ""),
        tenantName: String(formData.get("tenantName") ?? ""),
        tenantSlug: slug,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      window.location.href = tenantUrl(result.data.tenantSlug, "/admin");
    });
  }

  return (
    <form action={submit} className="space-y-5">
      {error && <div className="rounded-xl border border-destructive bg-background p-4 text-sm text-destructive">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama lengkap" name="fullName" />
        <Field label="Email panitia" name="email" type="email" />
      </div>
      <Field label="Kata sandi" name="password" type="password" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama organisasi" name="tenantName" value={tenantName} onChange={handleTenantNameChange} />
        <Field label="Instansi" name="institution" required={false} />
      </div>
      <div>
        <label htmlFor="tenantSlug" className="text-sm font-semibold">Subdomain</label>
        <div className="mt-2 flex rounded-full border border-border bg-background px-4 focus-within:ring-2 focus-within:ring-ring">
          <input
            id="tenantSlug"
            name="tenantSlug"
            value={slug}
            onChange={(event) => setSlug(slugify(event.target.value))}
            className="min-h-12 flex-1 bg-transparent outline-none"
            required
          />
          <span className="flex items-center text-sm text-muted-foreground">.ayopilih.id</span>
        </div>
        <div className="mt-2 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className={isAvailable ? "text-success" : "text-muted-foreground"}>{slugMessage}</p>
          <p className="font-mono text-xs text-muted-foreground">{previewUrl}</p>
        </div>
      </div>
      <button disabled={isPending || !isAvailable} className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">
        {isPending ? "Memproses..." : "Buat Pemilihan Gratis"}
      </button>
    </form>
  );
}

function Field({ label, name, type = "text", required = true, value, onChange }: { label: string; name: string; type?: string; required?: boolean; value?: string; onChange?: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-semibold">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="mt-2 min-h-12 w-full rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
