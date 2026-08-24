"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOutAndRedirectAction } from "@/app/actions/auth";
import {
  LayoutDashboard,
  Vote,
  Users,
  ClipboardList,
  Palette,
  BarChart2,
  FileText,
  Settings,
  Package,
  LogOut,
  ChevronRight,
  ChevronLeft,
  X,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/pemilihan", label: "Pemilihan", icon: Vote },
  { href: "/admin/paslon", label: "Paslon", icon: Users },
  { href: "/admin/dpt", label: "DPT", icon: ClipboardList },
  { href: "/admin/tampilan", label: "Tampilan", icon: Palette },
  { href: "/admin/monitor", label: "Monitor", icon: BarChart2 },
  { href: "/admin/laporan", label: "Laporan", icon: FileText },
  { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
  { href: "/admin/pengaturan/paket", label: "Paket", icon: Package },
];

export function AdminSidebar({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsMobileOpen(false);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const sidebarWidth = isCollapsed ? "lg:w-16" : "lg:w-64";

  return (
    <div className="min-h-dvh bg-background flex">
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:sticky md:top-0 md:self-start md:h-screen z-50 w-64 bg-background border-r border-border flex flex-col transition-all duration-200 ease-in-out",
          sidebarWidth,
          isMobile
            ? isMobileOpen
              ? "translate-x-0"
              : "-translate-x-full"
            : "translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-2 font-display text-xl font-extrabold tracking-tight",
              isCollapsed && "lg:justify-center lg:w-full"
            )}
          >
            <Image
              src="/icon.png"
              alt=""
              width={32}
              height={32}
              className="h-7 w-7 shrink-0"
              priority
            />
            <span className={cn(isCollapsed && "lg:hidden", "tracking-tight")}>
              <span className="text-primary">Ayo</span>Pilih
            </span>
          </Link>
          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Tutup sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto p-3 space-y-1"
          role="navigation"
          aria-label="Admin navigation"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  isCollapsed && "lg:justify-center lg:px-2",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setIsMobileOpen(false)}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span className={cn("truncate", isCollapsed && "lg:hidden")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: collapse toggle (desktop) + sign out */}
        <div className="border-t border-border p-3 space-y-2">
          <button
            type="submit"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className={cn(
              "hidden md:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              isCollapsed && "lg:justify-center lg:px-2"
            )}
            aria-label={isCollapsed ? "Buka sidebar" : "Tutup sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5 flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span>Tutup Sidebar</span>
              </>
            )}
          </button>

          <form action={signOutAndRedirectAction}>
            <button
              type="submit"
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors",
                isCollapsed && "lg:justify-center lg:px-2"
              )}
              title={isCollapsed ? "Keluar" : undefined}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span className={cn(isCollapsed && "lg:hidden")}>Keluar</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 h-14 bg-background/95 backdrop-blur border-b border-border flex items-center justify-between px-4">
          <button
            className="p-2 -ml-2 rounded-lg hover:bg-muted"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Buka menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/admin" className="font-display text-xl font-extrabold tracking-tight">
            <span className="text-primary">Ayo</span>Pilih
          </Link>
          <div className="w-10" />
        </header>

        {/* Breadcrumb */}
        <Breadcrumb pathname={pathname} />

        {/* Page Content */}
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 || (segments[0] !== "tenant" && segments[0] !== "admin")) {
    return null;
  }

  const adminSegments = segments.slice(2);
  if (adminSegments.length === 0 || adminSegments[0] !== "admin") {
    return null;
  }

  const items = adminSegments.slice(1);
  if (items.length === 0) {
    return null;
  }

  const labelMap: Record<string, string> = {
    pemilihan: "Pemilihan",
    paslon: "Paslon",
    dpt: "DPT",
    tampilan: "Tampilan",
    monitor: "Monitor",
    laporan: "Laporan",
    pengaturan: "Pengaturan",
    paket: "Paket",
    baru: "Baru",
    edit: "Edit",
    audit: "Audit Log",
  };

  return (
    <nav
      className="hidden md:flex md:items-center md:gap-2 md:px-8 md:pt-6 md:pb-2 text-sm"
      aria-label="Breadcrumb"
    >
      <Link
        href="/admin"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Dashboard
      </Link>
      {items.map((segment, index) => {
        const isLast = index === items.length - 1;
        const href = "/admin/" + items.slice(0, index + 1).join("/");
        const label = labelMap[segment] ?? segment;

        return (
          <span key={segment} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            {isLast ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link href={href} className="text-muted-foreground hover:text-foreground">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}