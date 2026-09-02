# SAAS_BUSINESS_MODEL.md — SKEMA MONETISASI AYOPILIH

---

## 1. PAKET LANGGANAN

| Fitur | **Starter** (Gratis) | **Pro** (Sekolah/Kampus) | **Enterprise** |
|---|---|---|---|
| Harga | Rp 0 | Rp 299.000 / pemilihan | Mulai Rp 2.500.000 / tahun |
| Maks pemilih per pemilihan | **100** | **2.000** | Tanpa batas |
| Pemilihan aktif bersamaan | 1 | 3 | Tanpa batas |
| Maks paslon | 5 | 20 | Tanpa batas |
| Mode voting | ONLINE_ONLY | Semua (Online/Offline/Hybrid) | Semua |
| Halaman profil pemilihan | ✅ | ✅ | ✅ |
| Ganti warna tema | ❌ (merah AyoPilih) | ✅ | ✅ + logo di email |
| Upload logo | ✅ | ✅ | ✅ |
| Favicon subdomain | ✅ | ✅ | ✅ |
| Live count realtime | ✅ | ✅ | ✅ |
| Export CSV | ✅ | ✅ | ✅ |
| Berita acara PDF berkop | ❌ | ✅ | ✅ |
| Kirim token via WhatsApp | ❌ | ✅ | ✅ |
| Kirim token via Email | ❌ | ✅ | ✅ |
| Anggota panitia | 1 | 5 | Tanpa batas |
| Custom domain (`pemilu.sman1.sch.id`) | ❌ | ❌ | ✅ |
| Hapus label "Didukung AyoPilih" | ❌ | ❌ | ✅ |
| Audit log & retensi data | 30 hari | 1 tahun | 5 tahun |
| Dukungan | Komunitas | Email (1×24 jam) | Prioritas + SLA 99,9% + pendampingan hari-H |

**Add-on:** +1.000 pemilih tambahan Rp 100.000 · Pendampingan teknis hari-H Rp 750.000 · Cetak kartu token Rp 1.500/lembar

---

## 2. LOGIKA PEMBATASAN (RATE LIMIT / PAYWALL)

Semua batas dicek **di server** (Server Action), bukan cuma disembunyikan di UI.

```ts
// lib/plans.ts
export const PLAN_LIMITS = {
  STARTER:    { maxVoters: 100,   maxActiveElections: 1,  maxCandidates: 5,
                maxMembers: 1,    modes: ["ONLINE_ONLY"],
                customTheme: false, whatsapp: false, email: false,
                pdfReport: false, customDomain: false, branding: true,
                auditRetentionDays: 30 },
  PRO:        { maxVoters: 2000,  maxActiveElections: 3,  maxCandidates: 20,
                maxMembers: 5,    modes: ["ONLINE_ONLY","OFFLINE_TPS","HYBRID"],
                customTheme: true,  whatsapp: true,  email: true,
                pdfReport: true,  customDomain: false, branding: true,
                auditRetentionDays: 365 },
  ENTERPRISE: { maxVoters: Infinity, maxActiveElections: Infinity, maxCandidates: Infinity,
                maxMembers: Infinity, modes: ["ONLINE_ONLY","OFFLINE_TPS","HYBRID"],
                customTheme: true,  whatsapp: true,  email: true,
                pdfReport: true,  customDomain: true, branding: false,
                auditRetentionDays: 1825 },
} as const;
```

### Titik penegakan

| Aksi | Cek |
|---|---|
| `bulkInsertVoters` | `jumlahDPTsekarang + barisBaru <= maxVoters` — kalau lewat, tolak seluruh batch, jangan potong sebagian |
| `createElection` | Jumlah pemilihan berstatus `SCHEDULED`/`ONGOING` < `maxActiveElections` |
| `createCandidate` | Jumlah paslon < `maxCandidates` |
| `updateElection` (voting_mode) | Mode ada di `modes` |
| `updateBranding` (theme_color) | `customTheme === true` |
| `inviteMember` | Jumlah anggota < `maxMembers` |
| `sendTokensViaWhatsapp` | `whatsapp === true` |
| `exportBeritaAcara` (PDF) | `pdfReport === true` |

### Pola pesan saat batas tercapai

Jangan tampilkan "Forbidden". Tampilkan: **apa batasnya, posisi sekarang, dan jalan keluarnya.**

> "Paket Starter menampung 100 pemilih. File yang diunggah berisi 340 baris, dan saat ini sudah ada 0 pemilih terdaftar. Naik ke paket Pro untuk menampung sampai 2.000 pemilih, atau unggah maksimal 100 baris."
> `[Lihat Paket Pro]` `[Unggah Ulang]`

### Peringatan dini
- Kuota terpakai ≥ 80% → banner `warning` di dashboard.
- Kuota terpakai 100% → banner + tombol upgrade menonjol.

---

## 3. LABEL "DIDUKUNG AYOPILIH"

Tampil di footer halaman pemilih untuk paket Starter & Pro:
`Didukung oleh AyoPilih` (tautan ke `ayopilih.id`, teks kecil, `text-muted-foreground`, tidak mengganggu). Ini kanal akuisisi utama — setiap pemilih adalah calon panitia di organisasi lain.

---

## 4. ALUR KONVERSI

> **Perubahan model bisnis (Q3 2026):** Tenant **tidak lagi bisa dibuat self-service**. Panitia yang ingin memakai AyoPilih harus menghubungi tim AyoPilih; super admin yang membuat tenant baru, mengirim undangan aktivasi ke email panitia owner, lalu panitia atur kata sandi dan masuk ke subdomain mereka. Ini mengubah alur konversi dari "self-serve" menjadi "managed onboarding". Detail di §8.

```
Panitia datang via rujukan / SEO
   → Lihat landing ayopilih.id
   → "Hubungi kami untuk mendaftarkan organisasimu" (email/WhatsApp)
   → Tim AyoPilih verifikasi kebutuhan
   → Super admin buat tenant + kirim undangan
   → Panitia aktivasi (atur kata sandi) → masuk subdomain → buat pemilihan
   → Upload DPT asli (misal 340 siswa) → KENA BATAS 100
   → Hubungi AyoPilih untuk upgrade ke Pro
```

Prinsip: **setiap tenant baru melewati verifikasi manual** untuk menjaga kualitas onboarding dan mencegah spam/abuse. Fitur inti (voting + live count) tidak pernah dikunci di sisi fitur — yang dibatasi adalah skala dan paket.

---

## 5. PEMBAYARAN

- Fase 1 (MVP): transfer manual + konfirmasi. Super admin mengubah `tenants.plan` dari dashboard internal. Nol biaya integrasi.
- Fase 2: Midtrans / Xendit Snap. Tambahkan tabel `subscriptions` (tenant_id, plan, status, period_start, period_end, invoice_url) dan `payments`.
- Model Pro bersifat **per-pemilihan**, bukan langganan bulanan — sesuai kenyataan pemilihan OSIS/BEM yang setahun sekali. Enterprise baru berlangganan tahunan.

---

## 6. BATASAN TEKNIS FREE TIER (PENTING)

| Layanan | Batas gratis | Dampak |
|---|---|---|
| Supabase DB | 500 MB | Cukup untuk ~500.000 baris suara |
| Supabase Storage | 1 GB | Kompres foto paslon ke WebP ≤ 200 KB |
| Supabase Realtime | 200 koneksi bersamaan | Live count publik pakai polling 5 detik; realtime hanya untuk dashboard panitia |
| Supabase Auth | 50.000 MAU | Hanya panitia yang pakai Auth — pemilih pakai token, tidak menghitung MAU |
| Vercel | 100 GB bandwidth/bulan | Optimalkan gambar dengan `next/image` |
| Supabase proyek gratis | Dijeda setelah 7 hari tidak aktif | Jadwalkan cron ping mingguan |

Konsekuensi desain: **pemilih tidak boleh memakai Supabase Auth.** Verifikasi token → sesi cookie sendiri. Ini juga alasan `vote_sessions` ada.

---

## 7. METRIK YANG DIPANTAU

Akuisisi: tenant baru/minggu, % yang membuat pemilihan pertama dalam 7 hari.
Aktivasi: % pemilihan yang benar-benar dibuka, waktu daftar → pemilihan pertama.
Konversi: % Starter → Pro, pemicu upgrade paling sering.
Kesehatan: rata-rata partisipasi (target > 80%), tingkat kegagalan verifikasi token (target < 3%), laporan gangguan hari-H.

---

## 8. ONBOARDING TERKELOLA (MANAGED) — Q3 2026

Mulai Q3 2026, AyoPilih pindah dari model **self-serve** (panitia daftar sendiri di `/daftar`) menjadi **managed onboarding** (hanya super admin yang bisa membuat tenant baru).

### Kenapa berubah

| Alasan | Penjelasan |
|---|---|
| **Kualitas onboarding** | Setiap tenant melewati verifikasi kebutuhan — panitia baru dapat bimbingan awal yang relevan dengan organisasinya. |
| **Mencegah spam / abuse** | Subdomain tidak bisa dipesan otomatis untuk nama-nama yang sudah dipakai merek lain, nama tokoh publik, atau kata-kata berhak cipta. |
| **Hubungan jangka panjang** | Kontak pertama via email/WhatsApp membuka ruang diskusi paket (Pro/Enterprise) sebelum panitia mengunggah DPT dan "kena batas" Starter. |

### Alur teknis

1. **Panitia menghubungi tim AyoPilih** (email `hello@ayopilih.id` atau WhatsApp sales).
2. **Tim AyoPilih memverifikasi** kebutuhan (skala pemilihan, jadwal hari-H, apakah perlu pendampingan).
3. **Super admin login ke `/internal`**, klik kartu **"Buat Tenant Baru"**, isi:
   - Nama organisasi
   - Slug subdomain (real-time availability check; reserved words ditolak)
   - Email panitia owner
   - Paket awal (Starter / Pro / Enterprise)
4. Sistem (`createTenantByAdmin` Server Action):
   - Memastikan slug tersedia
   - Membuat akun Supabase Auth untuk email panitia (kalau email sudah ada, pakai akun yang sama)
   - Insert baris `tenants` dengan `owner_id` = panitia
   - Insert baris `tenant_members` dengan role `OWNER`
   - Mencatat `audit_logs`: `action = "TENANT_CREATED"`, `actor_label` = email super admin, `meta = { slug, email, plan, createdBy: "super_admin" }`
5. **Undangan aktivasi** dikirim ke email panitia berisi tautan untuk atur kata sandi (`resetPasswordForEmail` Supabase Auth, redirect ke subdomain tenant `/admin`).
6. Panitia klik tautan → atur kata sandi → otomatis masuk ke subdomain tenant-nya.

### Dampak ke UI

- Halaman `/daftar` **dihapus** (redirect ke `/masuk`).
- Navbar landing **tidak menampilkan tombol "Buat Pemilihan"** lagi.
- Halaman `/masuk` menampilkan ajakan "Hubungi kami untuk mendaftarkan organisasimu" (tautan mailto/WhatsApp), bukan "Daftar gratis".
- Fitur-fitur lama di `/daftar` (input slug, upload logo, pilih paket) dipindahkan ke form super admin di `/internal/tenants/new`.

### Yang TIDAK berubah

- Panitia tetap membuat akun melalui Supabase Auth (sign-up tidak otomatis — aktivasi via email).
- Akun yang sudah ada (dari fase self-serve sebelum Q3 2026) tetap berfungsi normal.
- `signUpWithTenant` di Server Action **dipertahankan** di kode (untuk kompatibilitas dan potensi reopen di masa depan), tapi tidak lagi dipanggil dari UI publik.
