# AGENTS.md — ATURAN KERJA UNTUK AI AGENT (opencode)

File ini dibaca otomatis oleh opencode setiap sesi. Ringkas, tegas, jangan diabaikan.

## Proyek

**AyoPilih** — SaaS e-voting multi-tenant untuk sekolah, kampus, dan organisasi di Indonesia.
Stack: Next.js 15 (App Router, TypeScript) + Tailwind v4 + Shadcn UI + Supabase.

## Dokumen rujukan (baca sebelum mengerjakan slice)

| File | Isi |
|---|---|
| `PROJECT_BLUEPRINT.md` | Visi, arsitektur, peta route, roadmap slice |
| `DATABASE_SCHEMA.sql` | Skema DB, RLS, fungsi `cast_vote()` |
| `DESIGN_SYSTEM.md` | Token warna, tipografi, komponen, copywriting |
| `SECURITY.md` | Aturan anonimitas & keamanan — **tidak bisa ditawar** |
| `SAAS_BUSINESS_MODEL.md` | Batas paket & titik penegakan |
| `docs/SLICES.md` | Acceptance criteria per slice |
| `docs/ENV_SETUP.md` | Daftar environment variable |

## Perintah

```bash
npm run dev          # dev server (Turbopack)
npm run build        # WAJIB lolos sebelum slice dinyatakan selesai
npm run lint
npx tsc --noEmit     # cek tipe
```

## Aturan mutlak

1. **Satu slice per sesi.** Jangan menyentuh file di luar cakupan slice yang sedang dikerjakan.
2. **Kode lengkap.** Dilarang menulis `// ... sisa kode`, `// TODO implement`, atau placeholder apa pun pada file yang dibuat.
3. **Baca sebelum menulis.** Selalu cek isi file yang sudah ada sebelum menimpanya. Jangan bikin file duplikat dengan nama berbeda (`utils.ts` vs `helpers.ts`).
4. **`votes` tidak boleh punya kolom yang mengarah ke pemilih.** Kalau sebuah fitur menuntut itu, tolak dan usulkan alternatif.
5. **`SUPABASE_SECRET_KEY` hanya di file yang diawali `import "server-only";`.** Tidak pernah di komponen client.
6. **Semua Server Action**: `"use server"` → validasi Zod → cek otorisasi → operasi → return `ActionResult`. Tidak melempar exception mentah ke client.
7. **Warna hanya dari token** di `DESIGN_SYSTEM.md`. Dilarang `bg-[#C81D1D]` atau `text-red-600` di komponen.
8. **Teks UI Bahasa Indonesia**, nama variabel/fungsi Bahasa Inggris.
9. **Mobile-first.** Uji mental di 360px sebelum menyatakan selesai.
10. **Akhiri setiap slice dengan Testing Steps** yang konkret: buka URL apa, klik apa, hasil yang diharapkan apa.
11. Setelah slice selesai, **centang checklist** di `PROJECT_BLUEPRINT.md` §8 dan update `docs/SLICES.md`.
12. Kalau ada keputusan arsitektur baru, tulis ke dokumen terkait pada sesi yang sama — jangan biarkan dokumen basi.

## Konvensi kode

- Di dalam ruang tenant (`app/tenant/`), parameter `slug` hanya digunakan untuk mengambil/memfilter data dari basis data. Dilarang keras menaruh `slug` ke dalam path URL (href, router.push, redirect, dll) karena slug direpresentasikan melalui subdomain oleh middleware. Gunakan helper dari `lib/routes.ts` untuk seluruh pembentukan tautan dan redirect.
- Server Component sebagai default; `"use client"` hanya kalau butuh state/effect/event handler.
- Nama file: `kebab-case.tsx`. Nama komponen: `PascalCase`. Fungsi: `camelCase`.
- Import alias: `@/` → root proyek.
- Data fetching di Server Component, mutasi lewat Server Action. Hindari route handler kecuali untuk webhook.
- Tipe bersama ada di `types/index.ts` — jangan mendefinisikan ulang tipe yang sudah ada di sana.
- `any` dilarang kecuali disertai komentar alasan di baris atasnya.
- Setiap halaman: sediakan `loading.tsx` dan penanganan `error`/empty state.
- Zod schema disimpan bersama actionnya, diekspor supaya bisa dipakai form di client.

## Yang tidak boleh dilakukan tanpa bertanya dulu

- Mengganti library inti (Supabase, Shadcn, Tailwind).
- Mengubah struktur tabel yang sudah ada di `DATABASE_SCHEMA.sql`.
- Menambah dependensi berbayar atau yang butuh kartu kredit.
- Menghapus file dokumen `.md` di root.
- Menjalankan `git push`, `git reset --hard`, atau perintah destruktif lain.

## Gaya komunikasi ke pengguna

Ringkas dan langsung. Setelah selesai, laporkan: file yang dibuat/diubah, cara mengujinya, dan apa yang jadi slice berikutnya. Tidak perlu paragraf pembuka basa-basi.
