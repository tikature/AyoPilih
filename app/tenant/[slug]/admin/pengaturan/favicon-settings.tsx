"use client";

import { useState, useTransition } from "react";
import { updateTenantFavicon } from "@/app/actions/settings";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface FaviconSettingsProps {
  tenantId: string;
  currentFaviconUrl: string | null;
}

const ALLOWED_TYPES = ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "application/octet-stream"];
const MAX_SIZE = 100 * 1024; // 100 KB
const MIN_DIMENSION = 128;

export function FaviconSettings({
  tenantId,
  currentFaviconUrl,
}: FaviconSettingsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleFileSelect(file: File) {
    setError("");

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Format file harus PNG atau ICO.");
      return;
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      setError("Ukuran file maksimal 100 KB.");
      return;
    }

    // Validate dimensions
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gagal memuat gambar"));
    });

    if (img.width < MIN_DIMENSION || img.height < MIN_DIMENSION) {
      URL.revokeObjectURL(img.src);
      setError(`Dimensi minimal ${MIN_DIMENSION}×${MIN_DIMENSION} piksel.`);
      return;
    }

    URL.revokeObjectURL(img.src);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileSelect(file);
  }

  async function handleSubmit() {
    if (!previewUrl) {
      setError("Pilih file favicon terlebih dahulu.");
      return;
    }
    setError("");
    setIsUploading(true);

    try {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = fileInput?.files?.[0];
      if (!file) {
        setError("File tidak ditemukan.");
        return;
      }

      const supabase = createClient();

      // Tentukan ekstensi dari MIME type agar konsisten
      const mimeToExt: Record<string, string> = {
        "image/png": "png",
        "image/x-icon": "ico",
        "image/vnd.microsoft.icon": "ico",
      };
      const fileExt =
        mimeToExt[file.type] ??
        file.name.split(".").pop()?.toLowerCase() ??
        "png";

      // Pakai path unik + nama favicon yang konsisten agar cache busting bekerja
      const timestamp = Date.now();
      const path = `${tenantId}/favicon-${timestamp}.${fileExt}`;

      console.log("[Favicon Upload]", { fileName: file.name, fileType: file.type, fileSize: file.size, path });

      const { error: uploadError } = await supabase.storage
        .from("tenant-logos")
        .upload(path, file, {
          contentType: file.type === "application/octet-stream"
            ? (fileExt === "ico" ? "image/x-icon" : "image/png")
            : file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("[Favicon Upload Error]", uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage.from("tenant-logos").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      console.log("[Favicon Uploaded]", publicUrl);

      startTransition(async () => {
        const result = await updateTenantFavicon({ tenantId, faviconUrl: publicUrl });
        if (result.ok) {
          toast.success("Favicon berhasil diperbarui.");
          window.location.reload();
        } else {
          console.error("[Favicon DB Update Error]", result.error);
          setError(result.error);
          toast.error(result.error);
        }
        setIsUploading(false);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal mengunggah favicon";
      console.error("[Favicon Submit Error]", err);
      setError(message);
      toast.error(message);
      setIsUploading(false);
    }
  }

  async function handleRemove() {
    startTransition(async () => {
      const result = await updateTenantFavicon({ tenantId, faviconUrl: "" });
      if (result.ok) {
        toast.success("Favicon dihapus. Menggunakan default AyoPilih.");
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-6 space-y-6">
      <h2 className="font-display text-xl font-bold">Identitas Subdomain</h2>

      <div className="space-y-4">
        <h3 className="font-semibold">Favicon Subdomain</h3>
        <p className="text-sm text-muted-foreground">
          Ikon ini akan tampil di tab browser dan saat disimpan ke layar utama HP.
          Tersedia untuk <strong>semua paket</strong> (termasuk Starter).
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".png,.ico"
            onChange={handleUpload}
            disabled={isUploading || isPending}
            className="flex-1 h-10 rounded-full border border-border bg-background px-4 text-sm disabled:opacity-60"
          />
          <button
            onClick={handleSubmit}
            disabled={isUploading || isPending || !previewUrl}
            className="h-10 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {isUploading ? "Mengunggah..." : "Simpan Favicon"}
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Preview */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border bg-white">
            {currentFaviconUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentFaviconUrl}
                alt="Favicon saat ini"
                className="h-10 w-10 object-contain"
              />
            ) : (
              <span className="text-sm text-muted-foreground">Default</span>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold">
              {currentFaviconUrl ? "Favicon saat ini" : "Menggunakan favicon default AyoPilih"}
            </p>
            {currentFaviconUrl && (
              <button
                onClick={handleRemove}
                disabled={isPending}
                className="text-sm text-destructive hover:underline disabled:opacity-60"
              >
                Hapus favicon (kembali ke default)
              </button>
            )}
          </div>
        </div>

        {previewUrl && (
          <div className="rounded-xl border border-success bg-success/10 p-4 text-sm text-success">
            Favicon baru siap disimpan. Klik Simpan Favicon untuk menerapkan.
          </div>
        )}
      </div>
    </section>
  );
}