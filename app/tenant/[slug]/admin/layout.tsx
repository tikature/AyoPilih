import { createClient } from "@/lib/supabase/server";
import { requireTenantAccess } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin-sidebar";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) {
    return <ForbiddenState href="/" />;
  }

  const access = await requireTenantAccess(tenant.id);
  if (!access.ok) {
    const { data: userResult } = await supabase.auth.getUser();
    const { data: membership } = userResult.user
      ? await supabase
          .from("tenant_members")
          .select("tenant:tenants(slug)")
          .eq("user_id", userResult.user.id)
          .maybeSingle()
      : { data: null };

    const ownSlug =
      (membership?.tenant as { slug?: string } | null | undefined)?.slug ?? "";

    return <ForbiddenState href={ownSlug ? `/admin` : "/masuk"} />;
  }

  return <AdminSidebar>{children}</AdminSidebar>;
}

function ForbiddenState({ href }: { href: string }) {
  return (
    <main className="min-h-dvh bg-muted px-4 py-20">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center">
        <p className="font-display text-6xl font-bold text-muted-foreground">403</p>
        <h1 className="mt-4 font-display text-2xl font-bold">Kamu tidak punya akses ke ruang ini</h1>
        <p className="mt-3 text-muted-foreground">Ruang ini hanya bisa dibuka oleh anggota tenant terkait.</p>
        <a
          href={href}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Kembali ke tenant milik sendiri
        </a>
      </div>
    </main>
  );
}