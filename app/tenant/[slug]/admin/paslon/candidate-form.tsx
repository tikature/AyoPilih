"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCandidate, updateCandidate } from "@/app/actions/candidate";
import { createClient } from "@/lib/supabase/client";
import type { Candidate } from "@/types";

export function CandidateForm({
  electionId,
  candidate,
}: {
  electionId: string;
  candidate?: Candidate;
}) {
  const [error, setError] = useState("");
  const [photoUrl, setPhotoUrl] = useState(candidate?.photo_url ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handlePhoto(file: File) {
    setError("");
    setIsUploading(true);
    try {
      const blob = await compressToWebp(file);
      if (blob.size > 200 * 1024) {
        setError("Foto masih lebih dari 200 KB setelah dikompres. Pilih foto yang lebih kecil.");
        return;
      }

      const supabase = createClient();
      const path = `${electionId}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("candidate-photos")
        .upload(path, blob, { contentType: "image/webp" });

      if (uploadError) {
        setError("Gagal mengunggah foto. Pastikan bucket candidate-photos sudah tersedia.");
        return;
      }

      const { data } = supabase.storage.from("candidate-photos").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
    } finally {
      setIsUploading(false);
    }
  }

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const input = {
        electionId,
        candidate_number: Number(formData.get("candidate_number")),
        name: String(formData.get("name") ?? ""),
        running_mate: String(formData.get("running_mate") ?? ""),
        short_bio: String(formData.get("short_bio") ?? ""),
        vision: String(formData.get("vision") ?? ""),
        mission: String(formData.get("mission") ?? ""),
        photo_url: photoUrl,
      };

      const result = candidate
        ? await updateCandidate(candidate.id, input)
        : await createCandidate(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/admin/paslon?election=${electionId}`);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-5 rounded-3xl border border-border bg-card p-6">
      {error && <div className="rounded-xl border border-destructive bg-background p-4 text-sm text-destructive">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nomor urut" name="candidate_number" type="number" defaultValue={candidate?.candidate_number?.toString() ?? ""} />
        <Field label="Nama ketua" name="name" defaultValue={candidate?.name ?? ""} />
      </div>
      <Field label="Nama wakil" name="running_mate" required={false} defaultValue={candidate?.running_mate ?? ""} />
      <Field label="Ringkasan singkat" name="short_bio" required={false} defaultValue={candidate?.short_bio ?? ""} />
      <TextArea label="Visi" name="vision" defaultValue={candidate?.vision ?? ""} />
      <TextArea label="Misi" name="mission" defaultValue={candidate?.mission ?? ""} />
      <div>
        <label className="text-sm font-semibold" htmlFor="photo">Foto paslon</label>
        <input
          id="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handlePhoto(file);
          }}
          className="mt-2 block w-full rounded-2xl border border-border bg-background p-4 text-sm"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Foto dikompres otomatis ke WebP maksimal 200 KB sebelum diunggah.
        </p>
        {isUploading && <p className="mt-2 text-sm text-info">Mengunggah foto...</p>}
        {photoUrl && <p className="mt-2 text-sm text-success">Foto siap digunakan.</p>}
      </div>
      <button
        disabled={isPending || isUploading}
        className="h-12 rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : candidate ? "Simpan Perubahan" : "Tambah Paslon"}
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
      <label htmlFor={name} className="text-sm font-semibold">{label}</label>
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

function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-semibold">{label}</label>
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="mt-2 min-h-28 w-full rounded-2xl border border-border bg-background p-4 outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

async function compressToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const maxWidth = 800;
  const scale = Math.min(1, maxWidth / bitmap.width);
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browser tidak mendukung kompresi gambar.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Gagal mengompres foto."));
      },
      "image/webp",
      0.78,
    );
  });
}
