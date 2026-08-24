import Link from "next/link";

export default function InternalPage() {
  return (
    <main className="min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold">Dashboard Super Admin</h1>
          <p className="text-muted-foreground">Area internal untuk dukungan operasional & billing</p>
        </header>

        <nav className="grid gap-4 md:grid-cols-4">
          <Link
            href="/internal/tenants/new"
            className="rounded-2xl border-2 border-primary bg-primary/5 p-6 hover:bg-primary/10 transition"
          >
            <h2 className="font-display text-xl font-bold text-primary">Buat Tenant Baru</h2>
            <p className="mt-2 text-sm text-muted-foreground">Tambah organisasi, set subdomain & paket</p>
          </Link>
          <Link
            href="/internal/tenants"
            className="rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition"
          >
            <h2 className="font-display text-xl font-bold">Daftar Tenant</h2>
            <p className="mt-2 text-sm text-muted-foreground">Kelola paket, status, audit</p>
          </Link>
          <Link
            href="/internal/monitor"
            className="rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition"
          >
            <h2 className="font-display text-xl font-bold">Monitor Pemilihan</h2>
            <p className="mt-2 text-sm text-muted-foreground">Pemilihan ONGOING lintas tenant</p>
          </Link>
          <Link
            href="/internal/health"
            className="rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition"
          >
            <h2 className="font-display text-xl font-bold">Kesehatan Sistem</h2>
            <p className="mt-2 text-sm text-muted-foreground">DB, Storage, aktivitas proyek</p>
          </Link>
        </nav>

        <section className="rounded-2xl border border-warning bg-warning/10 p-4 text-sm">
          <p className="font-semibold text-warning">⚠️ Peringatan Keamanan</p>
          <p className="mt-1 text-muted-foreground">
            Dashboard ini hanya untuk keperluan operasional. DILARANG mengakses data sensitif pemilih
            (DPT, token, hasil suara). Setiap akses dicatat di audit log.
          </p>
        </section>
      </div>
    </main>
  );
}