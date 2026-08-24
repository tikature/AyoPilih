import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewTenantForm } from "./new-tenant-form";

export default function NewTenantPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/internal"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Dashboard
      </Link>

      <h1 className="mt-6 font-display text-3xl font-bold">Buat Tenant Baru</h1>
      <p className="mt-3 text-muted-foreground">
        Buat organisasi baru, pilih subdomain, dan kirim tautan aktivasi ke email panitia owner.
      </p>

      <div className="mt-8 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <NewTenantForm />
      </div>
    </main>
  );
}
