import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

const GUIDE_STEPS = [
  {
    number: "01",
    title: "Daftar Akun & Buat Tenant",
    description:
      "Buka halaman <strong>Daftar</strong>, isi email, kata sandi, nama lengkap, dan nama organisasi. Pilih subdomain unik (mis. <code>sman1</code>). Sistem otomatis membuat ruang tenant di <code>sman1.ayopilih.id</code>.",
    details: [
      "Gunakan email aktif untuk notifikasi penting.",
      "Subdomain tidak bisa diubah setelah dibuat.",
      "Owner otomatis menjadi anggota dengan peran OWNER.",
    ],
  },
  {
    number: "02",
    title: "Buat Pemilihan",
    description:
      "Setelah login, buka <strong>Dashboard Admin</strong> → <strong>Kelola Pemilihan</strong> → <strong>Buat Pemilihan</strong>. Isi judul, subjudul, jadwal (mulai/selesai), zona waktu, dan mode voting (ONLINE_ONLY / OFFLINE_TPS / HYBRID). Klik <strong>Buat Pemilihan</strong>.",
    details: [
      "Minimal 2 paslon sebelum bisa Publikasikan.",
      "Mode HYBRID memerlukan paket Pro atau Enterprise.",
      "PIN Kios wajib diisi untuk mode OFFLINE_TPS/HYBRID.",
    ],
  },
  {
    number: "03",
    title: "Unggah DPT (Daftar Pemilih Tetap)",
    description:
      "Buka menu <strong>DPT</strong> pada pemilihan yang dibuat. Unduh template CSV/XLSX, isi kolom: <code>identifier</code> (NISN/NIM/NIK), <code>name</code>, <code>group</code> (kelas/prodi/jurusan), <code>email</code> (opsional), <code>phone</code> (opsional). Unggah file, periksa pratinjau (valid vs ditolak), lalu klik <strong>Simpan</strong>.",
    details: [
      "Sistem mendeteksi duplikat <code>identifier</code> otomatis.",
      "Nomor HP dinormalisasi ke format <code>+62</code>.",
      "Kuota pemilih mengikuti paket langganan (Starter: 100).",
    ],
  },
  {
    number: "04",
    title: "Generate Token Pemilih",
    description:
      "Setelah DPT tersimpan, klik tombol <strong>Buat Token</strong>. Token 8 karakter unik dibuat untuk setiap pemilih yang belum memilih. Token hanya ditampilkan <strong>sekali saja</strong> — wajib unduh CSV atau cetak kartu token (PDF, 8 kartu per A4). Simpan file di tempat aman.",
    details: [
      "Token di-hash (SHA-256 + pepper) sebelum disimpan.",
      "Token lama otomatis hangus jika generate ulang.",
      "Cetak kartu token memiliki QR code ke halaman masuk.",
    ],
  },
  {
    number: "05",
    title: "Buka & Pantau Pemilihan",
    description:
      "Klik <strong>Publikasikan</strong> pada detail pemilihan (hanya bisa jika ≥ 2 paslon). Pemilihan berstatus <strong>SCHEDULED</strong> hingga jam mulai, lalu <strong>ONGOING</strong> secara otomatis. Bagikan link <code>sman1.ayopilih.id/pemilihan-osis/masuk</code> ke pemilih. Pantau realtime di <strong>Monitor</strong>.",
    details: [
      "Live count terlihat di dashboard panitia (Realtime).",
      "Hasil publik hanya jika <strong>Tampilkan Hasil Publik</strong> diaktifkan.",
      "Setelah selesai, klik <strong>Tutup Pemilihan</strong> untuk mengunci hasil final.",
    ],
  },
];

export default function PanduanPage() {
  return (
    <main className="min-h-dvh bg-muted px-4 py-16">
      <div className="mx-auto max-w-3xl space-y-12">
        <header className="text-center space-y-4">
          <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Panduan Cepat Panitia
          </h1>
          <p className="text-lg text-muted-foreground">
            Lima langkah dari daftar sampai pemilihan selesai. Cocok untuk panitia pemula.
          </p>
          <Link
            href="/daftar"
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Mulai Sekarang
          </Link>
        </header>

        <section className="space-y-8" aria-labelledby="guide-heading">
          <h2 id="guide-heading" className="sr-only">
            Langkah-langkah panduan
          </h2>
          {GUIDE_STEPS.map((step) => (
            <article
              key={step.number}
              className="rounded-3xl border border-border bg-card p-6 sm:p-8"
            >
              <div className="flex gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-display text-2xl font-extrabold text-primary">
                  {step.number}
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-xl font-bold">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                  {step.details.length > 0 && (
                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      {step.details.map((detail, i) => (
                        <li key={i} className="flex gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-success" />
                          <span dangerouslySetInnerHTML={{ __html: detail }} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>

        <footer className="border-t border-border pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Butuh bantuan lebih lanjut?
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="mailto:support@ayopilih.id"
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 font-semibold hover:bg-muted"
            >
              Email: support@ayopilih.id
            </Link>
            <a
              href="https://wa.me/6281234567890?text=Halo%20AyoPilih%2C%20saya%20butuh%20bantuan"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-full bg-green-600 px-5 font-semibold text-white hover:bg-green-700"
            >
              WhatsApp
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}