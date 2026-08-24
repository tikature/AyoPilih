import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-muted px-4 py-20">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center">
        <h1 className="font-display text-6xl font-bold text-muted-foreground">404</h1>
        <p className="mt-4 font-display text-2xl font-bold">Ruang tidak ditemukan</p>
        <p className="mt-3 text-muted-foreground">Subdomain yang Anda cari tidak ada. Periksa URL atau buat pemilihan baru.</p>
        <Link href="/" className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover">
          Kembali ke halaman utama
        </Link>
      </div>
    </main>
  );
}
