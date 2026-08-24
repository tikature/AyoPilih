/**
 * Tenant theming helpers. The tenant layout converts `tenants.theme_color`
 * into CSS variables so components can use `bg-tenant` / `text-tenant`
 * instead of hardcoded hex values. See DESIGN_SYSTEM.md §4.
 */

export const THEME_PRESETS = [
  { name: "Merah AyoPilih", hex: "#C81D1D" },
  { name: "Maroon", hex: "#7E2326" },
  { name: "Biru", hex: "#1D4ED8" },
  { name: "Teal", hex: "#0F766E" },
  { name: "Indigo", hex: "#4338CA" },
  { name: "Amber", hex: "#B45309" },
  { name: "Hijau", hex: "#166534" },
  { name: "Hitam", hex: "#030303" },
] as const;

export const DEFAULT_THEME_COLOR = "#C81D1D";

export function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** "#C81D1D" -> "0 75% 45%" (the format Shadcn CSS variables expect). */
export function hexToHslString(hex: string): string {
  if (!isValidHex(hex)) return hexToHslString(DEFAULT_THEME_COLOR);

  const [r255, g255, b255] = hexToRgb(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Picks white or near-black text for the given background, whichever passes
 * WCAG AA. Returned as an HSL string for the --tenant-foreground variable.
 */
export function readableForeground(hex: string): string {
  if (!isValidHex(hex)) return "0 0% 100%";
  return contrastRatio(hex, "#FFFFFF") >= 4.5 ? "0 0% 100%" : "0 0% 1%";
}

/** For the theme picker UI: warns the panitia before they pick something unreadable. */
export function themeWarning(hex: string): string | null {
  if (!isValidHex(hex)) return "Kode warna harus berformat #RRGGBB.";
  const withWhite = contrastRatio(hex, "#FFFFFF");
  const withBlack = contrastRatio(hex, "#030303");
  if (Math.max(withWhite, withBlack) < 4.5) {
    return "Warna ini terlalu terang untuk teks putih dan terlalu gelap untuk teks hitam. Pilih warna yang lebih pekat agar tombol tetap terbaca.";
  }
  return null;
}
