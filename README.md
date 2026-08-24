# AyoPilih

Platform SaaS e-voting multi-tenant untuk sekolah, kampus, dan organisasi di Indonesia.
Next.js 15 · Tailwind v4 · Shadcn UI · Supabase · Vercel — semuanya di free tier.

---

## Isi repo ini

| File | Fungsi |
|---|---|
| `AGENTS.md` | Aturan kerja untuk AI agent (dibaca otomatis opencode) |
| `PROJECT_BLUEPRINT.md` | Visi, arsitektur, peta route, roadmap 10 slice |
| `DATABASE_SCHEMA.sql` | Skema Supabase + RLS + fungsi `cast_vote()` |
| `DESIGN_SYSTEM.md` | Palet merah/perak/hitam, tipografi, komponen, copywriting |
| `SECURITY.md` | Aturan anonimitas suara & keamanan (tidak bisa ditawar) |
| `SAAS_BUSINESS_MODEL.md` | Paket Starter/Pro/Enterprise & titik penegakan batas |
| `docs/SLICES.md` | Acceptance criteria tiap slice |
| `docs/ENV_SETUP.md` | Daftar kunci & tempat mengisinya |
| `opencode.json` | Konfigurasi opencode (instructions + permission) |
| `.env.local.example` | Template environment variable |

Kode yang sudah jadi (tinggal dipakai agent):

```
middleware.ts                 rewrite subdomain + guard admin
lib/supabase/client.ts        client browser (RLS aktif)
lib/supabase/server.ts        client server (RLS aktif)
lib/supabase/admin.ts         service role — server-only, hati-hati
lib/crypto/token.ts           generate & hash token, kode bukti, sesi bilik
lib/auth.ts                   requireTenantAccess / requireElectionAccess / audit
lib/plans.ts                  batas paket
lib/theme.ts                  hex → HSL, kontras, preset warna tenant
lib/utils.ts                  cn(), format tanggal ID, slugify, tenantUrl
types/index.ts                tipe bersama + ActionResult
app/actions/vote.ts           verifikasi token, kirim suara, cek bukti
app/actions/voters.ts         parsing DPT, bulk insert, generate token
app/globals.css               design token
```

---

## Mulai dari nol

```bash
# 1. Siapkan Supabase
#    Buat proyek → SQL Editor → tempel DATABASE_SCHEMA.sql → Run

# 2. Siapkan env
cp .env.local.example .env.local
openssl rand -base64 48   # untuk TOKEN_PEPPER
openssl rand -base64 48   # untuk SESSION_SECRET

# 3. Suruh agent mengerjakan Slice 1
opencode
```

Detail lengkap ada di `docs/ENV_SETUP.md`.

---

## Cara memberi perintah ke opencode

Satu sesi = satu slice. Contoh perintah yang efektif:

```
Kerjakan SLICE 1 sesuai docs/SLICES.md.
Baca dulu AGENTS.md, PROJECT_BLUEPRINT.md, dan DESIGN_SYSTEM.md.
Jangan menyentuh file di luar cakupan Slice 1.
Setelah selesai, jalankan npm run build dan tulis Testing Steps.
```

```
Kerjakan SLICE 4 (Manajemen DPT).
File lib/crypto/token.ts dan app/actions/voters.ts SUDAH ADA — pakai itu, jangan bikin ulang.
Fokus ke UI: halaman upload, pratinjau hasil parsing, tabel DPT, export kartu token PDF.
```

```
Review kode di app/actions/ terhadap SECURITY.md.
Laporkan setiap pelanggaran aturan anonimitas. Jangan langsung memperbaiki, lapor dulu.
```

Kalau agent mulai melebar atau bikin file duplikat, hentikan dan ingatkan:
> "Baca AGENTS.md poin 1 dan 3. Kembali ke cakupan slice ini."

---

## Aturan yang tidak boleh dilanggar

1. Tabel `votes` tidak boleh punya kolom apa pun yang mengarah ke pemilih.
2. `SUPABASE_SECRET_KEY` hanya di file dengan `import "server-only"`.
3. Token pemilih hanya muncul sekali saat digenerate; yang disimpan cuma hashnya.
4. Batas paket ditegakkan di server, bukan cuma disembunyikan di UI.
5. Warna diambil dari token CSS, bukan hex di komponen.

---

## Urutan pengerjaan

```
1  Fondasi & landing         6  Bilik suara & bukti
2  Multi-tenant & auth       7  Mode kios
3  Pemilihan & paslon        8  Live count realtime
4  DPT & token               9  Laporan & berita acara
5  Halaman profil pemilihan  10 Paket, rate limit, polish
```

MVP yang sudah bisa dipakai pemilihan sungguhan = setelah Slice 6.
