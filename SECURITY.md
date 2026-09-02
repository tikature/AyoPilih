# SECURITY.md — SPESIFIKASI KEAMANAN & ANONIMITAS AYOPILIH

Dokumen ini mengikat. Kalau ada permintaan fitur yang bertabrakan dengan aturan di sini, **aturan di sini yang menang** dan AI wajib mengingatkan.

---

## 1. ASAS LUBER JURDIL → IMPLEMENTASI TEKNIS

| Asas | Implementasi |
|---|---|
| **Langsung** | Satu token = satu orang = satu suara, tidak bisa diwakilkan |
| **Umum** | Semua pemilih di DPT dapat token, tanpa syarat tambahan |
| **Bebas** | Bilik suara tidak menampilkan identitas pemilih di layar setelah verifikasi |
| **Rahasia** | Tabel `votes` **tidak punya** `voter_id` — mustahil dilacak siapa memilih siapa |
| **Jujur** | Setiap pemilih dapat `vote_hash` untuk memverifikasi suaranya tercatat |
| **Adil** | Urutan paslon selalu berdasarkan nomor urut, tanpa penonjolan warna/posisi |

---

## 2. PEMISAHAN IDENTITAS DAN PILIHAN (INTI SISTEM)

```
voters                          votes
------                          -----
id            <── TIDAK ADA ──> election_id
identifier        RELASI        candidate_id
token_hash                      vote_hash
has_voted  ✓                    created_at (dibulatkan ke menit)
voted_at
```

Yang terjadi saat pemilih menekan "Kirim Suara" (satu transaksi, fungsi `cast_vote()`):
1. Baris `voters` dikunci (`SELECT ... FOR UPDATE`).
2. Cek `has_voted = false`, status bukan `BLOCKED`, waktu masih dalam jendela pemilihan.
3. `INSERT` ke `votes` — hanya `election_id`, `candidate_id`, `vote_hash`.
4. `UPDATE voters SET has_voted = true` — hanya flag, tanpa mencatat pilihan.
5. Commit. Kalau ada satu langkah gagal, semuanya dibatalkan.

**Aturan mati:**
- ❌ Dilarang menambah kolom apa pun ke `votes` yang bisa mengarah ke pemilih (`voter_id`, `identifier`, `ip`, `user_agent`, `device_id`, `session_id`).
- ❌ Dilarang menyimpan log yang memuat `voter_id` dan `candidate_id` bersamaan — termasuk di `audit_logs`, `console.log`, dan Sentry.
- ❌ Dilarang membuat view/join yang menghubungkan kedua tabel.

---

## 3. ANTI-KORELASI WAKTU

Kalau `votes.created_at` presisi milidetik dan `voters.voted_at` juga, siapa pun yang punya akses DB bisa mencocokkan keduanya berdasarkan urutan. Penanganan:

1. `votes.created_at` default `date_trunc('minute', now())` — presisi menit.
2. Untuk pemilihan kecil (< 50 pemilih), presisi diturunkan lagi ke jam: `date_trunc('hour', now())`.
3. Rekap yang ditampilkan ke publik hanya agregat, **tidak pernah** daftar suara satu per satu.
4. `ORDER BY` pada query rekap tidak boleh memakai `created_at`.

---

## 4. TOKEN PEMILIH

### Format
- 8 karakter, alfabet aman: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 karakter — tanpa `0 O 1 I L`).
- Ruang kunci ≈ 31⁸ ≈ 8.5 × 10¹¹ kombinasi.
- Dibuat dengan `crypto.getRandomValues()` — **bukan** `Math.random()`.

### Penyimpanan
```
token_hash = SHA-256( token_uppercase + ":" + TOKEN_PEPPER )
```
- `TOKEN_PEPPER` disimpan sebagai env server-only, minimal 32 byte acak.
- Token asli **tidak pernah** disimpan di database, tidak pernah masuk log, tidak pernah dikirim balik oleh API.
- Token hanya muncul sekali: pada file CSV/PDF yang diunduh panitia saat generate. Kalau file itu hilang, satu-satunya jalan adalah **generate ulang** (token lama otomatis hangus).

> Kenapa SHA-256 dan bukan bcrypt/argon2? Karena token dibuat acak dengan entropi tinggi (bukan password buatan manusia), sehingga tidak rentan dictionary attack, dan SHA-256 tersedia di Edge Runtime tanpa dependensi native. Rate limiting menutup celah brute force.

### Rate Limiting Verifikasi Token
| Sasaran | Batas |
|---|---|
| Per IP | 10 percobaan / 10 menit |
| Per pemilihan | 200 percobaan gagal / jam → notifikasi ke panitia |
| Setelah 5 gagal berturut-turut dari satu IP | Jeda 60 detik (exponential backoff) |

Implementasi: tabel `rate_limits` di Supabase atau Upstash Redis free tier. Untuk mode `OFFLINE_TPS`, limit per-IP dilonggarkan (semua pemilih dari IP yang sama) tapi tetap ada limit per menit.

---

## 5. SESI BILIK SUARA

- Setelah token diverifikasi, sistem membuat baris `vote_sessions` dan menaruh `session_token` di **httpOnly cookie**, `SameSite=Strict`, `Secure`, umur **10 menit**.
- Cookie hanya berlaku untuk path pemilihan terkait.
- Sesi `used = true` setelah suara terkirim → tidak bisa dipakai ulang.
- Sesi kedaluwarsa otomatis dibersihkan (cron harian Supabase).
- Token asli **tidak disimpan** di localStorage/sessionStorage — hanya cookie httpOnly.

---

## 6. BUKTI SUARA (VOTE RECEIPT)

```
vote_hash = SHA-256( election_id + ":" + random_nonce_32byte )
```
Ditampilkan ke pemilih dalam format terbaca: `AYP-4F2C-9K1D-B7E3`.

Sifatnya:
- ✅ Pemilih bisa cek di `ayopilih.id/cek` bahwa suaranya **tercatat** (ada di tabel).
- ❌ Kode itu **tidak** menampilkan pilihan siapa. Endpoint verifikasi hanya mengembalikan: `{ tercatat: true, pemilihan: "...", waktu: "20 Agustus 2026" }`.
- Alasan: kalau kode bisa membuktikan pilihan, itu membuka pintu jual-beli suara. Ini keputusan sadar, bukan keterbatasan.

---

## 7. PENCEGAHAN DOUBLE VOTING (BERLAPIS)

1. **Lapis DB**: `SELECT ... FOR UPDATE` di `cast_vote()` — race condition dari klik ganda/dua tab tidak lolos.
2. **Lapis constraint**: `voters.has_voted` + unique index pada `vote_sessions.session_token_hash`.
3. **Lapis sesi**: satu sesi hanya bisa dipakai sekali (`used` flag).
4. **Lapis UI**: tombol dinonaktifkan saat pengiriman, dialog konfirmasi sebelum kirim.
5. **Lapis idempoten**: kalau `cast_vote` melempar `ALREADY_VOTED`, UI menampilkan halaman "Anda sudah memilih" — bukan pesan error merah yang bikin panik.

---

## 8. ISOLASI MULTI-TENANT

- **Lapis 1** — Middleware: `slug` diambil dari host, divalidasi ke DB. Slug tidak dikenal → 404, bukan redirect. Permintaan langsung ke `/tenant` di root domain tanpa subdomain tenant juga ditolak dengan status 404 oleh middleware untuk mencegah bypass otentikasi/routing.
- **Lapis 2** — Query: semua query wajib memfilter `tenant_id` yang berasal dari sesi tenant, **bukan** dari parameter yang dikirim client.
- **Lapis 3** — RLS: kalaupun ada bug di lapis 1 & 2, Postgres menolak baris milik tenant lain.
- ID selalu UUID v4, tidak pernah integer berurutan (mencegah enumerasi).
- Panitia tenant A yang mencoba akses `/admin` tenant B → 403, dicatat di `audit_logs`.

---

## 9. KUNCI & ENVIRONMENT

| Kunci | Boleh di client? | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Publik |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Dilindungi RLS |
| `SUPABASE_SECRET_KEY` (service role) | ❌ **TIDAK PERNAH** | Bypass RLS |
| `TOKEN_PEPPER` | ❌ | Server-only |
| `SESSION_SECRET` | ❌ | Server-only |
| `KIOSK_MASTER_PIN` | ❌ | Server-only |

Aturan kode:
- File yang mengekspor service-role client **wajib** diawali `import "server-only";`.
- Dilarang `console.log` isi env, token, atau `token_hash`.
- Kalau kunci bocor: rotate di Supabase Dashboard → API → Reset, lalu regenerate semua token pemilih yang belum terpakai.

---

## 10. MODE KIOS (OFFLINE_TPS)

Risiko khusus: satu perangkat dipakai banyak orang bergantian.

- Setelah suara terkirim: layar konfirmasi 5 detik → **auto-reset** ke input token, semua state di-clear.
- Cookie sesi dihapus paksa saat reset.
- Tombol "Kembali" browser diblokir (`history.pushState` guard) di route `/kios`.
- Keluar dari mode kios butuh **PIN panitia** (`kiosk_pin_hash`, 6 digit, di-hash sama seperti token).
- Layar kios tidak menampilkan nama pemilih setelah verifikasi — cukup "Silakan mencoblos" — agar antrean di belakang tidak melihat identitas.
- Kios wajib fullscreen; disarankan browser kiosk mode.

---

## 11. VALIDASI INPUT

- Semua Server Action: schema Zod di baris pertama, sebelum menyentuh DB.
- Upload file: whitelist MIME (`image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`), maks 2 MB, nama file di-sanitasi jadi UUID.
- SVG di-sanitasi (buang `<script>`, `onload`) atau larang SVG kalau tidak ada sanitizer.
- CSV DPT: maks 5 MB / 20.000 baris; cegah CSV injection (sel yang diawali `= + - @` diberi prefix `'` saat export).
- `description` landing page: markdown ringan, di-render dengan sanitizer (`rehype-sanitize`). **Dilarang** `dangerouslySetInnerHTML` tanpa sanitasi.

---

## 12. AUDIT LOG

Yang **wajib** dicatat: buat/ubah/hapus pemilihan, buat/ubah/hapus paslon, upload DPT, generate token, revoke token, blokir pemilih, buka/tutup pemilihan, ubah jadwal, login panitia, akses ditolak.

Yang **dilarang** dicatat: isi token, pilihan pemilih, kombinasi `voter_id` + `candidate_id`, IP pemilih pada saat mencoblos.

Format: `{ actor_label, action, meta: { ... }, created_at }`. Audit log **tidak bisa diedit atau dihapus** dari UI.

---

## 13. CHECKLIST SEBELUM PEMILIHAN DIBUKA

Tampilkan checklist ini di dashboard panitia:

- [ ] Jumlah DPT sudah sesuai daftar resmi
- [ ] Tidak ada `identifier` duplikat
- [ ] Semua paslon punya foto, visi, dan misi
- [ ] Nomor urut paslon tidak lompat/duplikat
- [ ] Jadwal mulai & selesai benar (zona waktu WIB/WITA/WIT)
- [ ] Mode voting sudah dipilih
- [ ] Token sudah dibuat dan file kartu token sudah diunduh serta disimpan aman
- [ ] Halaman profil pemilihan sudah diisi (logo, deskripsi, tata tertib)
- [ ] PIN kios sudah diatur (jika mode OFFLINE_TPS/HYBRID)
- [ ] Uji coba 1 suara di lingkungan draft, lalu direset

---

## 14. BATASAN DASHBOARD SUPER ADMIN (`/internal`)

Dashboard super admin dibuat untuk **operasional** (dukungan hari-H, billing, kesehatan sistem), bukan untuk memeriksa data tenant. Prinsip: super admin **tidak boleh** melihat data yang sama dengan panitia — kalau dia bisa, maka bocoran dari internal sama berbahayanya dengan bocoran dari panitia.

### Arsitektur Super Admin

- **Tabel `platform_admins`** (terpisah dari `tenant_members`): berisi `user_id`, `email`, `is_active`. Hanya service role yang bisa akses (RLS `using (false)`).
- **Helper `lib/platform-auth.ts`** (terpisah dari `lib/auth.ts`): memvalidasi user via `platform_admins` lewat service role, catat `SUPER_ADMIN_VISIT` ke audit log. Bukan 403 — **404** untuk non-super-admin (jangan bocorkan keberadaan halaman).
- **Middleware `middleware.ts`**: memisahkan route:
  - `/internal/**` HANYA di root domain (`ayopilih.id`). Akses dari subdomain tenant → 404.
  - `/admin/**` HANYA di subdomain tenant (`sman1.ayopilih.id`). Akses dari root domain → 404.
- **Bootstrap**: `scripts/bootstrap-superadmin.ts` — dijalankan sekali saat setup awal, baca `SUPER_ADMIN_EMAILS`, isi `platform_admins` dari user yang sudah register lewat `/daftar`. Jika sudah ada data, tolak (pakai `--force` untuk override).

### Yang TIDAK BOLEH disediakan antarmuka super admin

- ❌ Melihat isi DPT: nama, identitas (NISN/NIM/NIK), email, telepon pemilih.
- ❌ Melihat token pemilih (walaupun `token_hash` saja) atau membuat token baru atas nama tenant.
- ❌ Melihat hasil perolehan suara sebelum pemilihan ditutup (`status = CLOSED`).
- ❌ Tombol "Lihat sebagai tenant" / impersonasi.
- ❌ Mengubah data pemilihan, paslon, atau DPT tenant tanpa jejak audit.

### Yang BOLEH

- ✅ Metadata tenant: nama, slug, paket, tanggal daftar, status aktif/non-aktif.
- ✅ Angka agregat per pemilihan: jumlah DPT, jumlah pemilih hadir, persentase partisipasi (lewat RPC `get_turnout()`, bukan `select * from votes`).
- ✅ Daftar pemilihan `ONGOING` lintas tenant (untuk dukungan saat panitia panik hari-H).
- ✅ Ubah paket tenant (dengan catatan wajib: nomor invoice atau bukti transfer, dan tanggal berlaku sampai).
- ✅ Bekukan tenant (`is_active = false`) dengan alasan tertulis; bisa dibatalkan.
- ✅ Kesehatan sistem: pemakaian DB & Storage Supabase, jumlah tenant, jumlah suara total, peringatan proyek idle.

### Catatan akses & audit

- Route `/internal` di root domain — bukan di ruang tenant.
- Dibatasi ke email di `SUPER_ADMIN_EMAILS`, dicek di server **tiap request** via `requirePlatformAdmin()`.
- Bukan super admin → **404**, bukan 403. Jangan bocorkan bahwa halamannya ada.
- Setiap kunjungan tercatat di `audit_logs` dengan `actor_label = email super admin`, `action = SUPER_ADMIN_VISIT`.

### Rencana masa depan: izin dukungan teknis (BELUM diimplementasi)

Kalau di kemudian hari super admin benar-benar perlu akses ke data tenant (misal investigasi laporan), polanya adalah **izin berdurasi** — bukan impersonasi:

- Panitia login ke dashboard mereka sendiri.
- Dari menu Pengaturan, mereka klik "Berikan izin dukungan 60 menit".
- Sistem generate token izin 60 menit, simpan di tabel `support_grants` (tenant_id, granted_by, expires_at, reason, super_admin_email).
- Super admin yang memegang izin ini, selama 60 menit, boleh melihat data tenant melalui API khusus yang menampilkan jejak "dilihat atas izin dukungan".
- Izin dan setiap akses dicatat di `audit_logs`.
- Panitia bisa membaca log izin mereka sendiri dari dashboard mereka.

Bukan dibangun sekarang — ini catatan supaya tidak ada usul "tambah aja tombol lihat sebagai tenant" di iterasi berikutnya. Pelanggaran batas-batas §14 harus ditolak bahkan oleh AI assistant yang menulis kode.
