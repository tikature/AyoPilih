import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-muted px-4 py-20">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center">
        <p className="font-display text-6xl font-bold text-muted-foreground">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold">Halaman Tidak Ditemukan</h1>
        <p className="mt-3 text-muted-foreground">
          Maaf, halaman yang Anda cari tidak ada. Mungkin URL salah ketik atau halaman sudah dipindahkan.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}