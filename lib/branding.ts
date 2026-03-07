import type { Team, TeamBranding } from "./types";

/* ── Defaults (Vantage West) ─────────────────────────────────────── */
const VW_NAME = "Vantage West Realty";
const VW_PRIMARY = "#1c759e";
const VW_SECONDARY = "#272727";

/* ── Color helpers ────────────────────────────────────────────────── */

/** Parse a hex color (#rrggbb) into [h, s, l] */
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return [h, s, l];
}

/** Convert [h, s, l] back to #rrggbb */
function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Derive dark (−12% lightness) and light (+12% lightness) variants */
export function deriveColorVariants(hex: string): {
  dark: string;
  light: string;
} {
  const [h, s, l] = hexToHsl(hex);
  return {
    dark: hslToHex(h, s, Math.max(0, l - 0.12)),
    light: hslToHex(h, s, Math.min(1, l + 0.12)),
  };
}

/* ── Initials ─────────────────────────────────────────────────────── */

/** First letter of up to two words → "VW", "R", "AB" */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0][0] ?? "?").toUpperCase();
  return ((words[0][0] ?? "") + (words[1][0] ?? "")).toUpperCase() || "?";
}

/* ── Branding footer ──────────────────────────────────────────────── */

export function getBrandingFooter(branding: TeamBranding): string {
  const year = new Date().getFullYear();
  if (branding.mode === "white_label") {
    return `© ${year} ${branding.name}. All rights reserved.`;
  }
  if (branding.mode === "custom" && branding.showPoweredBy) {
    return `© ${year} ${branding.name}. Powered by ${VW_NAME}.`;
  }
  return `© ${year} ${VW_NAME}. All rights reserved.`;
}

/* ── Resolver ─────────────────────────────────────────────────────── */

/**
 * Build a TeamBranding object from a Team row (or null/partial data).
 * Fills in Vantage West defaults for any missing fields.
 */
export function resolveTeamBranding(
  team: Partial<Team> | null | undefined
): TeamBranding {
  const mode = team?.branding_mode ?? "vantage";
  const name = team?.brand_name || team?.name || VW_NAME;
  const primaryColor = team?.brand_primary_color || VW_PRIMARY;
  const secondaryColor = team?.brand_secondary_color || VW_SECONDARY;
  const { dark: primaryDark, light: primaryLight } =
    deriveColorVariants(primaryColor);

  return {
    mode,
    name,
    logoUrl: team?.brand_logo_url ?? null,
    primaryColor,
    secondaryColor,
    primaryDark,
    primaryLight,
    showPoweredBy: team?.brand_show_powered_by ?? true,
    initials: getInitials(name),
  };
}
