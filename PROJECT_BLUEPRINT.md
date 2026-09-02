# BLUEPRINT PROYEK: SAAS E-VOTING — AYOPILIH.ID

Metode Pengembangan: Incremental / Extreme Programming (XP) — Potongan demi Potongan (Slice).
Versi Dokumen: 2.0
Status: Slice 0 (belum ada kode)

---

## 1. KONTEKS PROYEK & ROLE

- **Role AI**: Senior Full-Stack Developer & Software Architect.
- **Goal**: Membangun platform SaaS E-Voting Multi-Tenant "AyoPilih" untuk Sekolah, Kampus, Organisasi, dan Desa.
- **Asas Utama**: Anonimitas suara (LUBER JURDIL), Aman, Ringan, Real-time, dan Bebas Biaya Operasional (100% Free Tier Stack).
- **Bahasa UI**: Bahasa Indonesia (formal-ringkas). Bahasa kode & komentar: Inggris.
- **Target pengguna**:
  1. **Super Admin (AyoPilih)** — kelola tenant, paket langganan, moderasi.
  2. **Panitia/Admin Tenant** — buat pemilihan, upload DPT, atur paslon, atur tema & halaman profil, pantau hasil.
  3. **Pemilih (Voter)** — login pakai token, baca profil pemilihan, mencoblos sekali.
  4. **Publik** — lihat halaman profil pemilihan & hasil (jika dipublikasikan).

---

## 2. TECH STACK (100% FREE TIER)

| Layer | Teknologi | Catatan |
|---|---|---|
| Framework | Next.js 15 (App Router, TypeScript, Server Actions) | `--turbopack` untuk dev |
| Styling | Tailwind CSS v4 + Shadcn UI (style: new-york) | Token warna via CSS variable |
| Ikon | lucide-react | |
| Backend & DB | Supabase (PostgreSQL + Auth + Realtime + Storage) | Free tier |
| Validasi | Zod | Wajib di semua Server Action |
| Form | react-hook-form + @hookform/resolvers | |
| Tabel | @tanstack/react-table | Untuk DPT & rekap |
| Chart | recharts | Live count |
| Parsing CSV/Excel | papaparse + xlsx (SheetJS) | Bulk upload DPT |
| Notifikasi | sonner (toast) | |
| Deployment | Vercel (Wildcard Subdomain `*.ayopilih.id`) | |
| Runtime hash | Web Crypto API (SHA-256) | Edge-compatible, bukan bcrypt |

**Perintah setup awal (Slice 1):**
```bash
npx create-next-app@latest ayopilih --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"
npx shadcn@latest init
npx shadcn@latest add button card input label table dialog alert-dialog dropdown-menu form select badge tabs toast sonner avatar separator progress skeleton textarea switch radio-group tooltip sheet
npm i @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers @tanstack/react-table recharts papaparse xlsx lucide-react date-fns
npm i -D @types/papaparse
```

---

## 3. ARSITEKTUR MULTI-TENANT

- **Root domain** `ayopilih.id` → landing page marketing + register panitia.
- **Subdomain tenant** `sman1.ayopilih.id` → ruang tenant.
- **Dev lokal**: `sman1.localhost:3000` (harus jalan tanpa edit `/etc/hosts` di Chrome/Firefox modern).
- `middleware.ts` membaca `host`, mengekstrak `slug`, lalu rewrite ke `/tenant/[slug]/...`. (Garis bawah tidak boleh digunakan karena merupakan private folder di Next.js sehingga route di dalamnya tidak dapat diakses).
- Isolasi data dijamin ganda: **filter `tenant_id` di query** + **Row Level Security (RLS) di Supabase**.
- **Aturan Rute Ruang Tenant**: Browser hanya melihat subdomain dan path relatif pemilih (misal `sman1.localhost:3000/pemilihan-osis/bilik`). Middleware secara internal melakukan rewrite ke `/tenant/sman1/pemilihan-osis/bilik`. Karena itu, `slug` (sman1) tidak boleh masuk ke dalam string path routing atau redirect (seperti `/${slug}/${electionSlug}`) karena akan menghasilkan path duplikat dan 404. Gunakan `lib/routes.ts` untuk menangani pembentukan tautan.

### Peta Route

```
app/
├── (marketing)/                     # ayopilih.id
│   ├── page.tsx                     # Landing page
│   ├── harga/page.tsx               # Pricing
│   ├── panduan/page.tsx             # Dokumentasi panitia
│   └── cek/page.tsx                 # Cek keaslian hasil (verifikasi vote_hash)
├── (auth)/
│   ├── masuk/page.tsx               # Login panitia (Supabase Auth)
│   ├── daftar/page.tsx              # Daftar tenant baru (buat slug)
│   └── lupa-sandi/page.tsx
├── tenant/[slug]/                   # hasil rewrite middleware (Tanpa garis bawah)
│   ├── page.tsx                     # Halaman profil tenant (daftar pemilihan aktif)
│   ├── [electionSlug]/
│   │   ├── page.tsx                 # ★ LANDING PEMILIHAN (logo, deskripsi, paslon, countdown, tombol "Masuk Bilik Suara")
│   │   ├── paslon/page.tsx          # Detail visi-misi semua paslon
│   │   ├── masuk/page.tsx           # Input token pemilih
│   │   ├── bilik/page.tsx           # Bilik suara (butuh sesi voter)
│   │   ├── selesai/page.tsx         # Bukti nyoblos + kode verifikasi
│   │   ├── hasil/page.tsx           # Live count publik (kalau diizinkan panitia)
│   │   └── kios/page.tsx            # Mode OFFLINE_TPS: auto-reset setelah nyoblos
│   └── admin/
│       ├── page.tsx                 # Dashboard ringkasan
│       ├── pemilihan/               # CRUD pemilihan + mode voting
│       ├── paslon/                  # CRUD kandidat + upload foto
│       ├── dpt/                     # Bulk upload, sanitasi, generator token
│       ├── tampilan/                # ★ Branding: logo, warna tema, deskripsi halaman
│       ├── monitor/                 # Live count + partisipasi realtime
│       ├── laporan/                 # Export PDF/CSV berita acara
│       └── pengaturan/              # Anggota panitia, paket, domain
└── actions/                         # Server Actions (lihat §7)
```

---

## 4. KONSEP DPT & MODE VOTING

### DPT (Daftar Pemilih Tetap)
- Panitia upload CSV/XLSX berisi `identifier` (NISN/NIM/NIK), `name`, `email?`, `phone?`, `group?` (kelas/prodi/jurusan).
- Sistem **sanitasi**: trim spasi, buang baris kosong, normalisasi nomor HP ke `+62`, deteksi duplikat `identifier`, validasi panjang.
- Preview hasil parsing sebelum commit → panitia lihat baris valid vs ditolak (beserta alasannya).
- Generator token unik per pemilih: 8 karakter alfanumerik (tanpa karakter ambigu `0/O/1/I/l`).
- Token **hanya ditampilkan sekali** saat generate → panitia wajib download CSV/PDF kartu token.
- Yang disimpan di DB hanya `token_hash` (SHA-256 + `TOKEN_PEPPER`).

### Mode Voting (`elections.voting_mode`)
| Mode | Alur | Karakteristik |
|---|---|---|
| `ONLINE_ONLY` | Pemilih buka link → input token → coblos dari HP sendiri | Token dibagikan via WA/email/cetak |
| `OFFLINE_TPS` | Panitia buka `/kios` di laptop TPS → pemilih input token → coblos → layar auto-reset 5 detik | Kios terkunci (blokir back/refresh manual), butuh `kiosk_pin` untuk keluar |
| `HYBRID` | Dua-duanya aktif bersamaan | Token sama, satu suara tetap satu orang |

---

## 5. HALAMAN PROFIL PEMILIHAN (LANDING TENANT)

Pemilih **tidak langsung** masuk bilik suara. Urutan: **Landing → Masuk (token) → Bilik → Selesai**.

Isi landing yang dikelola panitia di `/admin/tampilan`:
1. `logo_url` — logo sekolah/organisasi (PNG/SVG, maks 1 MB).
2. `banner_url` — hero image opsional (16:9, maks 2 MB).
3. `title` & `subtitle` — mis. "Pemilihan Ketua OSIS SMAN 1 Purwokerto 2026".
4. `description` — rich text singkat (sambutan, tata tertib, dasar hukum).
5. `timeline` — JSON tahapan (kampanye, masa tenang, pencoblosan, pengumuman).
6. `contact_info` — narahubung panitia.
7. `show_candidates_before_login` — boolean, tampilkan paslon di landing atau tidak.
8. `show_public_result` — boolean, live count boleh dilihat publik atau hanya panitia.
9. `theme_color` — warna aksen tenant (default: merah AyoPilih `#C81D1D`).

---

## 6. ARSITEKTUR DATABASE (RINGKAS)

Detail lengkap + RLS ada di `DATABASE_SCHEMA.sql`.

1. `tenants` — id, name, slug, logo_url, theme_color, plan, owner_id, is_active
2. `tenant_members` — id, tenant_id, user_id, role (`OWNER`|`ADMIN`|`VIEWER`)
3. `elections` — id, tenant_id, slug, title, description, banner_url, voting_mode, start_time, end_time, status, kiosk_pin_hash, show_public_result, timeline (jsonb)
4. `candidates` — id, election_id, candidate_number, name, running_mate, vision, mission, photo_url
5. `voters` — id, election_id, identifier, name, group_name, token_hash, status, has_voted, voted_at
6. `votes` — id, election_id, candidate_id, vote_hash, created_at ← **TANPA `voter_id`**
7. `audit_logs` — id, tenant_id, actor, action, meta (jsonb), created_at
8. `vote_sessions` — id, voter_id, session_token_hash, expires_at (sesi bilik 10 menit)

> **PENTING**: `votes` tidak boleh punya kolom apapun yang menghubungkan ke `voters`. Urutan `created_at` di-fuzz (dibulatkan ke menit) agar tidak bisa dikorelasikan dengan `voted_at`.

---

## 7. SERVER ACTIONS (KONTRAK)

| File | Fungsi | Ringkas |
|---|---|---|
| `app/actions/tenant.ts` | `createTenant`, `updateBranding`, `checkSlugAvailability` | Slug unik, reserved words diblokir |
| `app/actions/election.ts` | `createElection`, `updateElection`, `publishElection`, `closeElection`, `updateLandingPage` | Validasi jadwal, tidak bisa edit setelah ada suara masuk |
| `app/actions/candidate.ts` | `createCandidate`, `updateCandidate`, `deleteCandidate`, `reorderCandidates` | Nomor urut unik per pemilihan |
| `app/actions/voters.ts` | `parseVoterFile`, `bulkInsertVoters`, `generateTokens`, `revokeToken`, `blockVoter`, `exportTokens` | Kuota paket dicek di sini |
| `app/actions/vote.ts` | `verifyToken`, `submitVote`, `verifyReceipt` | Jantung sistem, wajib idempotent |
| `app/actions/report.ts` | `getLiveCount`, `getTurnout`, `exportBeritaAcara` | |

Aturan wajib setiap action:
1. `"use server"` di baris pertama.
2. Validasi input dengan Zod schema.
3. Cek otorisasi (`requireTenantAccess(tenantId)`) sebelum menyentuh data.
4. Return bertipe `ActionResult<T>` = `{ ok: true, data }` | `{ ok: false, error, field? }`. **Jangan lempar exception mentah ke client.**
5. Tulis `audit_logs` untuk semua aksi destruktif.

---

## 8. PETA ROADMAP POTONGAN KUE (XP SLICES)

- [x] **SLICE 1** — Setup proyek, koneksi Supabase, design token, landing page `ayopilih.id`
- [x] **SLICE 2** — Middleware multi-tenant + wildcard subdomain + auth panitia (daftar/masuk/buat tenant)
- [x] **SLICE 3** — Dashboard admin: CRUD pemilihan, mode voting, CRUD paslon + upload foto
- [x] **SLICE 4** — Manajemen DPT: bulk upload + sanitasi + preview + generator token + export kartu token
- [x] **SLICE 5** — Halaman profil pemilihan (branding panitia) + halaman masuk token
- [x] **SLICE 6** — Bilik suara online + halaman bukti nyoblos + verifikator publik
- [x] **SLICE 7** — Mode Kios (OFFLINE_TPS) auto-reset + PIN keluar
- [x] **SLICE 8** — Live count realtime (Supabase Realtime) + monitor partisipasi
- [x] **SLICE 10** — Paywall paket (Starter/Pro/Enterprise) + rate limiting + polish mobile
- [x] **SLICE 11** — Dashboard Super Admin `/internal` (daftar tenant, ubah paket, monitor pemilihan, bekukan tenant, kesehatan sistem)

### Arsitektur Super Admin (Baru)
- Tabel `platform_admins` (terpisah dari `tenant_members`) di `DATABASE_SCHEMA.sql`
- Helper `lib/platform-auth.ts` terpisah dari `lib/auth.ts` — cek `platform_admins` via service role
- Middleware memisahkan: `/internal/**` hanya di root domain, `/admin/**` hanya di subdomain tenant
- Route `/internal` di root domain (bukan di ruang tenant).
- Dibatasi ke email di `SUPER_ADMIN_EMAILS`, dicek di server tiap request via `requirePlatformAdmin()`.
- Yang bukan super admin dapat **404**, bukan 403 — jangan bocorkan bahwa halamannya ada.
- Setiap kunjungan tercatat di `audit_logs` (`SUPER_ADMIN_VISIT`).
- Bootstrap: `scripts/bootstrap-superadmin.ts` — jalan sekali saat setup, baca `SUPER_ADMIN_EMAILS`, isi `platform_admins` dari user yang sudah register lewat `/daftar`.

Detail acceptance criteria tiap slice ada di `docs/SLICES.md`.

---

## 9. ATURAN KERJA AI

1. Kerjakan **HANYA 1 Slice** dalam satu waktu. Jangan lompat ke slice berikutnya tanpa diminta.
2. Berikan kode **LENGKAP**, tanpa placeholder `// ... code here` atau `// rest of the code`.
3. Setiap akhir slice, tulis **Testing Steps** yang bisa dieksekusi manual (klik apa, ketik apa, hasil yang diharapkan).
4. Gunakan Shadcn UI + Tailwind. Ambil warna **hanya** dari token di `DESIGN_SYSTEM.md` — dilarang hardcode hex di komponen.
5. Mobile-first. Semua halaman pemilih wajib enak dipakai di layar 360px.
6. Semua teks yang dilihat pengguna dalam Bahasa Indonesia; nama variabel/fungsi dalam Bahasa Inggris.
7. Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` di file dengan `"use client"` atau di komponen yang di-import client.
8. Sebelum membuat file baru, cek dulu apakah file sejenis sudah ada. Jangan bikin duplikat.
9. Kalau ada keputusan arsitektur yang berubah, **update dokumen ini** di slice yang sama.
10. Update checklist di §8 (`[ ]` → `[x]`) setiap kali slice selesai.

---

## 10. DEFINITION OF DONE (per Slice)

- [ ] `npm run build` lolos tanpa error TypeScript.
- [ ] Tidak ada `any` yang tidak diberi komentar alasan.
- [ ] Semua Server Action punya validasi Zod + cek otorisasi.
- [ ] Halaman baru responsif di 360px, 768px, 1280px.
- [ ] Loading state & empty state tersedia (bukan layar kosong).
- [ ] Error message menjelaskan cara memperbaiki, bukan cuma "Terjadi kesalahan".
- [ ] Testing steps ditulis dan sudah dicoba.
