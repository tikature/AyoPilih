import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats an ISO string as "20 Agustus 2026, 14.30 WIB". */
export function formatDateTimeID(iso: string, timeZone = "Asia/Jakarta"): string {
  const zoneLabel =
    timeZone === "Asia/Jakarta" ? "WIB" : timeZone === "Asia/Makassar" ? "WITA" : "WIT";
  const formatted = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));
  return `${formatted} ${zoneLabel}`;
}

export function formatDateID(iso: string, timeZone = "Asia/Jakarta"): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone }).format(
    new Date(iso),
  );
}

/** "Pemilihan Ketua OSIS 2026" -> "pemilihan-ketua-osis-2026" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 32)
    .replace(/^-|-$/g, "");
}

/** Builds an absolute tenant URL that works in dev and production. */
export function tenantUrl(slug: string, path = ""): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const protocol = root.includes("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${root}${path}`;
}

export function percentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}
