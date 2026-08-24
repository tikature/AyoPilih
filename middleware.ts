import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

/**
 * AyoPilih multi-tenant middleware.
 *
 * ayopilih.id            -> marketing site (no rewrite)
 * sman1.ayopilih.id      -> rewrite to /_tenant/sman1
 * sman1.localhost:3000   -> rewrite to /_tenant/sman1 (local dev)
 *
 * Also refreshes the Supabase auth session cookie and guards /admin routes.
 */

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

// Subdomains that must never be treated as a tenant.
const RESERVED = new Set([
  "www", "app", "admin", "api", "auth", "cdn", "mail", "support",
  "status", "docs", "blog", "staging", "preview",
]);

function extractSubdomain(host: string): string | null {
  // Drop the port, lowercase everything.
  const hostname = host.split(":")[0].toLowerCase();
  const rootHostname = ROOT_DOMAIN.split(":")[0].toLowerCase();

  // Vercel preview deployments: tenant---branch.vercel.app
  if (hostname.endsWith(".vercel.app")) {
    const label = hostname.split(".")[0];
    return label.includes("---") ? label.split("---")[0] : null;
  }

  if (hostname === rootHostname) return null;
  if (!hostname.endsWith(`.${rootHostname}`)) return null;

  const sub = hostname.slice(0, -(rootHostname.length + 1));
  // Only single-level subdomains are tenants (a.b.ayopilih.id is not).
  if (!sub || sub.includes(".")) return null;
  if (RESERVED.has(sub)) return null;

  return sub;
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // --- Refresh the Supabase session cookie on every request. ---
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: CookieOptions;
          }>,
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const subdomain = extractSubdomain(host);

  // --- Root domain: marketing + auth pages + /internal, no rewrite needed. ---
  if (!subdomain) {
    // Prevent direct access to /tenant route on root domain to bypass subdomain constraint
    if (pathname === "/tenant" || pathname.startsWith("/tenant/")) {
      return new NextResponse("Not Found", { status: 404 });
    }
    // /internal is only accessible at root domain
    return response;
  }

  // --- Shared API routes live at the root app, never inside /tenant. ---
  if (pathname.startsWith("/api/")) {
    return response;
  }

  // --- Block /internal on tenant subdomain (super admin only at root) ---
  if (pathname === "/internal" || pathname.startsWith("/internal/")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // --- Tenant subdomain: protect the admin area. ---
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminRoute && !user) {
    const protocol = request.nextUrl.protocol;
    const loginUrl = new URL(`${protocol}//${ROOT_DOMAIN}/masuk`);
    loginUrl.searchParams.set("next", `${host}${pathname}`);
    return NextResponse.redirect(loginUrl);
  }

  // Rewrite into the internal tenant route. The tenant layout is responsible for
  // resolving the slug against the database and returning notFound() if unknown,
  // and the admin layout verifies that the signed-in user belongs to this tenant.
  const rewritten = new URL(`/tenant/${subdomain}${pathname}`, request.url);
  rewritten.search = url.search;

  const tenantResponse = NextResponse.rewrite(rewritten, { request });
  // Carry over any refreshed auth cookies.
  response.cookies.getAll().forEach((cookie) => {
    tenantResponse.cookies.set(cookie);
  });
  tenantResponse.headers.set("x-tenant-slug", subdomain);

  return tenantResponse;
}

export const config = {
  matcher: [
    /*
     * Run on everything except:
     * - _next/static, _next/image
     * - favicon and common static assets
     * - files with an extension
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)",
  ],
};
