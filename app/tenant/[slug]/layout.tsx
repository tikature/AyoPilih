import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hexToHslString, readableForeground } from "@/lib/theme";
import type { Tenant } from "@/types";

const DEFAULT_FAVICON = "/favicon.ico";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, favicon_url, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) {
    return {};
  }

  // Cache-bust: ?v=<updated_at> ensures browser refetches when favicon changes
  const cacheBuster = `?v=${encodeURIComponent(tenant.updated_at || new Date().toISOString())}`;
  const faviconUrl = tenant.favicon_url
    ? `${tenant.favicon_url}${cacheBuster}`
    : `${DEFAULT_FAVICON}${cacheBuster}`;

  return {
    title: {
      default: tenant.name,
      template: `%s — ${tenant.name}`,
    },
    icons: {
      icon: [{ url: faviconUrl, type: getFaviconType(tenant.favicon_url) }],
      apple: [{ url: faviconUrl }],
    },
  };
}

function getFaviconType(url: string | null): string {
  if (!url) return "image/png";
  if (url.toLowerCase().endsWith(".ico")) return "image/x-icon";
  if (url.toLowerCase().endsWith(".png")) return "image/png";
  if (url.toLowerCase().endsWith(".jpg") || url.toLowerCase().endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

export default async function TenantLayout({
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
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) {
    notFound();
  }

  const tenantData = tenant as unknown as Tenant;
  const style = {
    "--tenant": hexToHslString(tenantData.theme_color),
    "--tenant-foreground": readableForeground(tenantData.theme_color),
  } as React.CSSProperties;

  return (
    <div style={style} className="min-h-dvh bg-background">
      {children}
    </div>
  );
}