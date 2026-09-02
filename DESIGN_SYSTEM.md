# DESIGN SYSTEM — AYOPILIH.ID

Panduan visual wajib. **Dilarang hardcode warna hex di komponen** — selalu pakai token Tailwind/CSS variable di bawah.

---

## 1. FILOSOFI

Pemilu itu urusan serius: hasilnya harus terasa **resmi, tegas, dan tidak bisa diragukan**. Karena itu palet AyoPilih memakai merah bendera di atas dasar abu-perak dan hitam tinta — bukan gradasi ungu-biru khas SaaS. Merah dipakai **sedikit tapi menentukan** (tombol aksi, nomor urut paslon, bar hasil); sisanya netral supaya angka dan nama paslon yang jadi bintang.

Aturan emas: **satu layar, satu aksi merah.** Kalau ada dua tombol merah di satu layar, salah satu harus diturunkan jadi `secondary` atau `outline`.

---

## 2. PALET WARNA INTI

| Nama Token | Hex | Peran |
|---|---|---|
| `ink` | `#030303` | Teks utama, footer, latar mode kios |
| `graphite` | `#71706F` | Teks sekunder, label, ikon nonaktif |
| `maroon` | `#7E2326` | Hover/pressed tombol merah, aksen header cetak |
| `mist` | `#DAD8D8` | Latar halaman, kartu sekunder, garis pemisah |
| `crimson` | `#C81D1D` | **Primary** — CTA, nomor urut, highlight hasil |
| `silver` | `#A8A9AB` | Border, placeholder, disabled state |

Warna pendukung (di luar palet, hanya untuk status sistem):

| Token | Hex | Peran |
|---|---|---|
| `success` | `#15803D` | "Suara berhasil tercatat" |
| `warning` | `#B45309` | Sisa kuota menipis, masa tenang |
| `info` | `#1D4ED8` | Info netral, tooltip |

> Hijau **tidak boleh** dipakai untuk paslon manapun agar tidak terkesan memihak. Kartu paslon selalu netral; pembeda antar paslon adalah **nomor urut**, bukan warna.

---

## 3. CSS TOKENS (Tailwind v4 + Shadcn)

Taruh di `app/globals.css`. Nilai HSL supaya kompatibel dengan Shadcn.

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 1%;              /* #030303 */

  --card: 0 0% 100%;
  --card-foreground: 0 0% 1%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 1%;

  --primary: 0 75% 45%;               /* #C81D1D */
  --primary-foreground: 0 0% 100%;
  --primary-hover: 358 57% 32%;       /* #7E2326 */

  --secondary: 0 3% 85%;              /* #DAD8D8 */
  --secondary-foreground: 0 0% 1%;

  --muted: 0 3% 92%;
  --muted-foreground: 30 1% 44%;      /* #71706F */

  --accent: 0 3% 85%;
  --accent-foreground: 0 0% 1%;

  --destructive: 0 75% 45%;
  --destructive-foreground: 0 0% 100%;

  --success: 142 72% 29%;
  --warning: 33 92% 37%;
  --info: 224 76% 40%;

  --border: 220 2% 66%;               /* #A8A9AB */
  --input: 220 2% 66%;
  --ring: 0 75% 45%;

  --radius: 0.5rem;

  /* Warna aksen milik tenant — di-override inline oleh layout tenant */
  --tenant: 0 75% 45%;
  --tenant-foreground: 0 0% 100%;
}

.dark {
  --background: 0 0% 1%;
  --foreground: 0 3% 92%;
  --card: 0 0% 6%;
  --card-foreground: 0 3% 92%;
  --popover: 0 0% 6%;
  --popover-foreground: 0 3% 92%;
  --primary: 0 75% 50%;
  --primary-foreground: 0 0% 100%;
  --secondary: 0 0% 14%;
  --secondary-foreground: 0 3% 92%;
  --muted: 0 0% 14%;
  --muted-foreground: 220 2% 66%;
  --accent: 0 0% 16%;
  --accent-foreground: 0 3% 92%;
  --border: 30 1% 28%;
  --input: 30 1% 28%;
  --ring: 0 75% 50%;
}

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-success: hsl(var(--success));
  --color-warning: hsl(var(--warning));
  --color-info: hsl(var(--info));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-tenant: hsl(var(--tenant));
  --color-tenant-foreground: hsl(var(--tenant-foreground));
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground antialiased; }
  :focus-visible { @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-background; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 4. TEMA PER TENANT

Default semua tenant = merah AyoPilih `#C81D1D`. Panitia boleh mengganti di `/admin/tampilan`.

**Cara kerja**: `app/_tenant/[slug]/layout.tsx` membaca `tenants.theme_color`, mengubah hex → HSL, lalu menyuntikkan sebagai inline style di elemen pembungkus.

```tsx
// app/_tenant/[slug]/layout.tsx (potongan)
import { hexToHslString, readableForeground } from "@/lib/theme";

const style = {
  "--tenant": hexToHslString(tenant.theme_color),          // "210 90% 45%"
  "--tenant-foreground": readableForeground(tenant.theme_color),
} as React.CSSProperties;

return <div style={style} className="min-h-dvh bg-background">{children}</div>;
```

Aturan pemakaian:
- Halaman **pemilih** (landing, masuk, bilik, hasil) → pakai `bg-tenant`, `text-tenant`, `border-tenant`.
- Halaman **admin & marketing AyoPilih** → tetap pakai `primary` (merah AyoPilih), jangan ikut warna tenant, supaya panitia tetap sadar sedang di produk mana.
- Pilihan warna tenant dibatasi ke 8 preset + custom picker. Preset: `#C81D1D` (Merah AyoPilih), `#7E2326` (Maroon), `#1D4ED8` (Biru), `#0F766E` (Teal), `#4338CA` (Indigo), `#B45309` (Amber), `#166534` (Hijau), `#030303` (Hitam).
- Validasi kontras: kalau rasio kontras teks putih di atas warna pilihan < 4.5:1, sistem otomatis pakai teks hitam (`readableForeground`).

---

## 5. TIPOGRAFI

| Peran | Font | Alasan |
|---|---|---|
| Display / heading | **Plus Jakarta Sans** (700/800) | Buatan desainer Indonesia, tegas, huruf lebar — cocok untuk nama paslon dan angka besar |
| Body / UI | **Inter** (400/500/600) | Netral, terbaca di layar kecil |
| Angka & data | **JetBrains Mono** (500) | Untuk token, kode bukti, dan tabel rekap — angka rata lebar (tabular) |

```ts
// app/layout.tsx
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";

const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display", weight: ["700","800"] });
const body    = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono    = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["500"] });
```

**Skala tipe** (mobile → desktop):

| Kelas | Ukuran | Pemakaian |
|---|---|---|
| `text-4xl md:text-6xl font-display font-extrabold tracking-tight` | 36→60px | Judul hero landing |
| `text-2xl md:text-3xl font-display font-bold` | 24→30px | Judul pemilihan, judul halaman admin |
| `text-lg font-semibold` | 18px | Nama paslon di kartu |
| `text-base` | 16px | Body — **minimum untuk halaman pemilih**, jangan lebih kecil |
| `text-sm text-muted-foreground` | 14px | Label, keterangan |
| `font-mono text-xl tracking-[0.2em]` | 20px | Token & kode bukti |

---

## 6. KOMPONEN SHADCN WAJIB

`button` `card` `input` `label` `table` `dialog` `alert-dialog` `dropdown-menu` `form` `select` `badge` `tabs` `sonner` `avatar` `separator` `progress` `skeleton` `textarea` `switch` `radio-group` `tooltip` `sheet`

### Komponen kustom AyoPilih

| Komponen | Fungsi |
|---|---|
| `<CandidateCard />` | Foto 4:5, nomor urut besar di pojok, nama, tombol "Lihat visi-misi" |
| `<BallotOption />` | Versi bilik suara: area sentuh minimal 64px, ring merah tebal saat dipilih, wajib konfirmasi |
| `<TokenInput />` | 8 kotak karakter, auto-uppercase, auto-advance, dukung paste |
| `<CountdownTimer />` | Hitung mundur ke `start_time`/`end_time` |
| `<LiveBarChart />` | Bar horizontal realtime, warna `tenant`, angka mono di kanan |
| `<TurnoutRing />` | Lingkaran persentase partisipasi |
| `<KioskShell />` | Latar `ink`, tanpa navigasi, tombol keluar butuh PIN |
| `<EmptyState />` | Ikon + kalimat ajakan + tombol aksi (bukan layar kosong) |
| `<StepIndicator />` | Progres 4 langkah: Profil → Masuk → Coblos → Selesai |

---

## 7. TANDA TANGAN VISUAL (SIGNATURE)

**Nomor urut sebagai elemen utama.** Di setiap kartu paslon, nomor urut ditampilkan sebagai angka display raksasa (`text-7xl`, `font-display`, warna `mist`) yang menempel di sudut kartu dan sebagian terpotong oleh tepi kartu — seperti nomor pada surat suara asli. Saat kartu dipilih di bilik suara, angka itu berubah dari `mist` menjadi `crimson`. Satu gerakan, satu warna, tidak perlu animasi lain.

---

## 8. LAYOUT & RESPONSIVITAS

- **Mobile-first.** Breakpoint uji wajib: 360px, 768px, 1280px.
- Lebar konten maksimum: `max-w-6xl` (admin), `max-w-2xl` (halaman pemilih — fokus, satu kolom).
- Spacing pakai kelipatan 4: `gap-2 gap-4 gap-6 gap-8`.
- Grid paslon: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Area sentuh minimal **44×44px**; tombol di bilik suara minimal **64px** tinggi.
- Tabel DPT di mobile → berubah jadi daftar kartu, jangan scroll horizontal.
- Sticky bottom bar untuk aksi utama di halaman bilik suara.

---

## 9. AKSESIBILITAS (WAJIB)

- Kontras teks minimal 4.5:1. Jangan pakai `silver` untuk teks di atas `mist`.
- Semua input punya `<label>`, bukan cuma placeholder.
- Fokus keyboard harus terlihat (`ring-2 ring-ring`).
- Pilihan paslon di bilik suara = `radiogroup` dengan navigasi panah, bisa diselesaikan tanpa mouse.
- `prefers-reduced-motion` dihormati.
- Foto paslon wajib `alt` berisi nama dan nomor urut.

---

## 10. NADA TULISAN (COPY)

- Bahasa Indonesia, kalimat aktif, sopan tapi tidak kaku.
- Tombol menyebut aksinya: "Masuk Bilik Suara", "Kirim Suara", "Unduh Kartu Token" — bukan "Submit" atau "OK".
- Konsisten: tombol "Kirim Suara" → toast "Suara terkirim".
- Error menjelaskan cara memperbaiki:
  - ✅ "Token tidak dikenali. Periksa lagi 8 karakternya, atau hubungi panitia untuk token baru."
  - ❌ "Invalid token."
- Empty state adalah ajakan: "Belum ada paslon. Tambahkan paslon pertama untuk memulai."
- Kata baku yang dipakai konsisten: **paslon** (bukan kandidat), **pemilih**, **panitia**, **bilik suara**, **DPT**, **suara** (bukan vote).
