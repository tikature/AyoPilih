"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateElectionBranding } from "@/app/actions/election";
import { updateTenantBranding } from "@/app/actions/tenant";
import { THEME_PRESETS, themeWarning } from "@/lib/theme";
import { PLAN_LIMITS } from "@/lib/plans";
import { createClient } from "@/lib/supabase/client";
import type { Election, TimelineItem, PlanType } from "@/types";

export function BrandingForm({
  election,
  tenant,
}: {
  election: Election;
  tenant: { id: string; plan: string; theme_color: string; logo_url?: string | null };
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [timeline, setTimeline] = useState<TimelineItem[]>(election.timeline ?? []);
  
  // Theme state
  const [themeColor, setThemeColor] = useState(tenant.theme_color);
  const [themeWarningMsg, setThemeWarningMsg] = useState<string | null>(null);

  // Upload states
  const [logoUrl, setLogoUrl] = useState(tenant.logo_url ?? "");
  const [bannerUrl, setBannerUrl] = useState(election.banner_url ?? "");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const router = useRouter();
  
  const limits = PLAN_LIMITS[tenant.plan as PlanType];
  const canCustomTheme = limits.customTheme;

  function handleThemeChange(color: string) {
    if (!canCustomTheme) return;
    setThemeColor(color);
    setThemeWarningMsg(themeWarning(color));
  }

  async function handleLogoUpload(file: File) {
    setError("");
    setIsUploadingLogo(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const path = `${tenant.id}/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("tenant-logos")
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        setError("Gagal mengunggah logo: " + uploadError.message);
        return;
      }

      const { data } = supabase.storage.from("tenant-logos").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || "Gagal mengunggah logo");
    } finally {
      setIsUploadingLogo(false);
    }
  }

  async function handleBannerUpload(file: File) {
    setError("");
    setIsUploadingBanner(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const path = `${election.id}/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("election-banners")
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        setError("Gagal mengunggah banner: " + uploadError.message);
        return;
      }

      const { data } = supabase.storage.from("election-banners").getPublicUrl(path);
      setBannerUrl(data.publicUrl);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || "Gagal mengunggah banner");
    } finally {
      setIsUploadingBanner(false);
    }
  }

  function submit(formData: FormData) {
    setError("");
    setMessage("");
    startTransition(async () => {
      // Save tenant branding (theme and logo)
      const tenantResult = await updateTenantBranding({
        tenantId: tenant.id,
        theme_color: themeColor,
        logo_url: logoUrl,
      });

      if (!tenantResult.ok) {
        setError(tenantResult.error);
        return;
      }

      // Save election branding (banner, timeline, etc.)
      const result = await updateElectionBranding({
        electionId: election.id,
        title: String(formData.get("title") ?? ""),
        subtitle: String(formData.get("subtitle") ?? ""),
        description: String(formData.get("description") ?? ""),
        banner_url: bannerUrl,
        timeline,
        contact_info: String(formData.get("contact_info") ?? ""),
        show_candidates_before_login: formData.get("show_candidates_before_login") === "on",
        show_public_result: formData.get("show_public_result") === "on",
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Branding pemilihan dan organisasi berhasil disimpan.");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-8">
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

      {/* TEMA WARNA */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold">Warna Tema Organisasi</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Warna ini akan diterapkan pada semua halaman bilik suara, landing pemilih, dan halaman selesai.
        </p>

        {!canCustomTheme && (
          <div className="mt-4 rounded-2xl border border-warning bg-background p-4 text-sm text-warning">
            Paket <strong>{limits.label}</strong> terkunci pada warna default AyoPilih. Naik ke paket Pro untuk mengubah warna tema.
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                disabled={!canCustomTheme}
                onClick={() => handleThemeChange(preset.hex)}
                className={`h-10 px-4 rounded-full border text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50 ${
                  themeColor === preset.hex
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ backgroundColor: preset.hex }}
                />
                {preset.name}
              </button>
            ))}
          </div>

          {canCustomTheme && (
            <div className="flex items-center gap-3">
              <label htmlFor="custom-color" className="text-sm font-semibold">Warna Kustom:</label>
              <input
                id="custom-color"
                type="color"
                value={themeColor}
                onChange={(e) => handleThemeChange(e.target.value)}
                className="h-10 w-20 cursor-pointer rounded-lg border border-border bg-background p-1"
              />
              <span className="font-mono text-sm">{themeColor}</span>
            </div>
          )}

          {themeWarningMsg && (
            <div className="text-sm text-warning font-semibold">
              ⚠️ {themeWarningMsg}
            </div>
          )}
        </div>
      </section>

      {/* LOGO & BANNER */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold">Logo & Banner</h2>
        <div className="mt-5 space-y-6">
          {/* Logo Upload */}
          <div>
            <label className="text-sm font-semibold" htmlFor="logo-file">Logo Organisasi</label>
            <input
              id="logo-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleLogoUpload(file);
              }}
              className="mt-2 block w-full rounded-2xl border border-border bg-background p-4 text-sm"
            />
            {isUploadingLogo && <p className="mt-2 text-sm text-info">Mengunggah logo...</p>}
            {logoUrl && (
              <div className="mt-4 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded-xl border p-1 bg-white" />
                <span className="text-sm text-success font-semibold">Logo siap disimpan.</span>
              </div>
            )}
          </div>

          {/* Banner Upload */}
          <div>
            <label className="text-sm font-semibold" htmlFor="banner-file">Banner Halaman Pemilihan (16:9)</label>
            <input
              id="banner-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleBannerUpload(file);
              }}
              className="mt-2 block w-full rounded-2xl border border-border bg-background p-4 text-sm"
            />
            {isUploadingBanner && <p className="mt-2 text-sm text-info">Mengunggah banner...</p>}
            {bannerUrl && (
              <div className="mt-4 space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bannerUrl} alt="Banner" className="aspect-video max-w-sm object-cover rounded-2xl border" />
                <span className="text-sm text-success font-semibold block">Banner siap disimpan.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* INFORMASI DASAR */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold">Informasi Dasar</h2>
        <div className="mt-5 space-y-4">
          <Field label="Judul pemilihan" name="title" defaultValue={election.title} />
          <Field
            label="Subjudul"
            name="subtitle"
            required={false}
            defaultValue={election.subtitle ?? ""}
          />
          <div>
            <label htmlFor="description" className="text-sm font-semibold">
              Deskripsi
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={election.description ?? ""}
              className="mt-2 min-h-32 w-full rounded-2xl border border-border bg-background p-4 outline-none focus:ring-2 focus:ring-ring"
              placeholder="Deskripsi singkat, dasar hukum, tata tertib, dst. (markdown ringan)"
            />
          </div>
        </div>
      </section>

      {/* TIMELINE TAHAPAN */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold">Timeline Tahapan</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tampilkan di halaman profil pemilihan untuk informasi pemilih.
        </p>
        <div className="mt-5 space-y-4">
          {timeline.map((item, index) => (
            <div key={index} className="rounded-2xl border border-border bg-background p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Label tahapan"
                  name={`timeline[${index}].label`}
                  defaultValue={item.label}
                />
                <Field
                  label="Deskripsi"
                  name={`timeline[${index}].description`}
                  defaultValue={item.description ?? ""}
                  required={false}
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field
                  label="Mulai"
                  name={`timeline[${index}].start`}
                  type="date"
                  defaultValue={item.start.split("T")[0]}
                />
                <Field
                  label="Selesai"
                  name={`timeline[${index}].end`}
                  type="date"
                  defaultValue={item.end.split("T")[0]}
                />
              </div>
              <button
                type="button"
                onClick={() => setTimeline((t) => t.filter((_, i) => i !== index))}
                className="mt-3 h-10 rounded-full border border-destructive px-4 text-sm font-semibold text-destructive hover:bg-destructive hover:text-primary-foreground"
              >
                Hapus
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setTimeline((t) => [...t, { label: "", start: "", end: "", description: "" }])
          }
          className="mt-4 h-11 rounded-full border border-border bg-background px-5 font-semibold hover:bg-muted"
        >
          Tambah Tahapan
        </button>
      </section>

      {/* KONTAK & PENGATURAN */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold">Kontak & Pengaturan</h2>
        <div className="mt-5 space-y-4">
          <Field
            label="Narahubung panitia"
            name="contact_info"
            required={false}
            defaultValue={election.contact_info ?? ""}
            placeholder="Nama, email, nomor HP"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
              <input
                name="show_candidates_before_login"
                type="checkbox"
                defaultChecked={election.show_candidates_before_login}
                className="h-4 w-4"
              />
              <span className="text-sm font-semibold">Tampilkan paslon sebelum login</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
              <input
                name="show_public_result"
                type="checkbox"
                defaultChecked={election.show_public_result}
                className="h-4 w-4"
              />
              <span className="text-sm font-semibold">Hasil publik (live count)</span>
            </label>
          </div>
        </div>
      </section>

      <button
        disabled={isPending || isUploadingLogo || isUploadingBanner}
        className="h-12 rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Simpan Branding"}
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
