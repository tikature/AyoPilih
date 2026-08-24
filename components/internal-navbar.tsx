"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Activity, HeartPulse, LogOut } from "lucide-react";
import { signOutAndRedirectAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/internal", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/internal/tenants", label: "Tenant", icon: Building2 },
  { href: "/internal/monitor", label: "Monitor", icon: Activity },
  { href: "/internal/health", label: "Kesehatan Sistem", icon: HeartPulse },
];

export function InternalNavbar({ email }: { email: string }) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      className="sticky top-0 z-50 w-full bg-foreground text-background border-b border-background/10"
      aria-label="Super admin navigation"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/internal"
            className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight"
          >
            <Image
              src="/icon.png"
              alt=""
              width={32}
              height={32}
              className="h-7 w-7 shrink-0"
              priority
            />
            <span className="tracking-tight">
              <span className="text-primary">Ayo</span>Pilih
            </span>
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
              Super Admin
            </span>
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-background/70 hover:bg-background/10 hover:text-background"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-background/50">
              Super Admin
            </p>
            <p className="text-sm font-medium leading-tight text-background/90">
              {email}
            </p>
          </div>

          <form action={signOutAndRedirectAction}>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-background/10 px-4 text-sm font-semibold text-background transition-colors hover:bg-destructive hover:text-primary-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Keluar</span>
            </button>
          </form>
        </div>
      </div>

      <ul className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <li key={item.href} className="flex-shrink-0">
              <Link
                href={item.href}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-background/70 hover:bg-background/10 hover:text-background"
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}