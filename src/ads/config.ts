/**
 * Central advertising configuration. Ads are presentation-only: nothing in
 * the simulation engine knows they exist. All credentials come from public
 * environment variables at build time — never commit real IDs.
 *
 *   NEXT_PUBLIC_AD_PROVIDER      none | placeholder | adsense   (default: placeholder in dev, none in prod)
 *   NEXT_PUBLIC_ADSENSE_CLIENT   ca-pub-XXXXXXXXXXXXXXXX
 *   NEXT_PUBLIC_ADSENSE_SLOTS    JSON map placementId -> slot id
 *   NEXT_PUBLIC_ADS_REQUIRE_CONSENT  "true" to gate ads behind the consent integration point
 */

export type AdDevice = "desktop" | "mobile" | "all";
export type AdFormat = "rail" | "inline" | "banner";

export interface AdPlacement {
  id: string;
  description: string;
  format: AdFormat;
  device: AdDevice;
  /** Route prefixes where this placement may render. */
  pages: string[];
  enabled: boolean;
  /** Reserved space to prevent layout shift. */
  minHeight: number;
  maxWidth?: number;
  /** Lower = more important when the per-page cap is hit. */
  priority: number;
}

export const PORTFOLIO_URL = "https://yuvraj-satyapal.vercel.app/";
export const SPONSOR_EMAIL = "yuvrajsatyapal21@gmail.com";
export const SPONSOR_SECTIONS = [1, 2, 3, 4] as const;
/** How often small-screen slots swap which section they show. */
export const SPONSOR_ROTATE_MS = 25_000;

export const AD_PLACEMENTS: AdPlacement[] = [

];

export const AD_RULES = {
  maxSlotsPerPage: 3,
  /** Never show ads while these game states are active. */
  blockedStates: ["live-match", "decision-modal", "negotiation", "new-career"] as const,
  /** Pages that never show ads (forms, decisions, onboarding). */
  neverOn: ["/new", "/play/transfers", "/play/training", "/play/settings", "/play/legacy"],
  /** Minimum width (px) before a side rail is allowed. */
  railMinViewport: 1440,
  /** Rewarded ads are optional and capped. */
  rewarded: { enabled: true },
};

export type AdProviderId = "none" | "placeholder" | "adsense";

function env(name: string): string | undefined {
  // Next inlines NEXT_PUBLIC_* at build time; keep explicit references so bundlers can replace them.
  const map: Record<string, string | undefined> = {
    NEXT_PUBLIC_AD_PROVIDER: process.env.NEXT_PUBLIC_AD_PROVIDER,
    NEXT_PUBLIC_ADSENSE_CLIENT: process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
    NEXT_PUBLIC_ADSENSE_SLOTS: process.env.NEXT_PUBLIC_ADSENSE_SLOTS,
    NEXT_PUBLIC_ADS_REQUIRE_CONSENT: process.env.NEXT_PUBLIC_ADS_REQUIRE_CONSENT,
  };
  return map[name];
}

export function adProviderId(): AdProviderId {
  const v = env("NEXT_PUBLIC_AD_PROVIDER");
  if (v === "none" || v === "placeholder" || v === "adsense") return v;
  return process.env.NODE_ENV === "production" ? "none" : "placeholder";
}

export function adsenseClient(): string | undefined {
  const v = env("NEXT_PUBLIC_ADSENSE_CLIENT");
  return v && /^ca-pub-\d{10,20}$/.test(v) ? v : undefined;
}

export function adsenseSlots(): Record<string, string> {
  try {
    return JSON.parse(env("NEXT_PUBLIC_ADSENSE_SLOTS") ?? "{}");
  } catch {
    return {};
  }
}

export function consentRequired(): boolean {
  return env("NEXT_PUBLIC_ADS_REQUIRE_CONSENT") === "true" || adProviderId() === "adsense";
}

export function placementsFor(pathname: string, isMobile: boolean, wide: boolean): AdPlacement[] {
  const path = pathname.replace(/\/$/, "") || "/";
  if (AD_RULES.neverOn.some((p) => path === p || path.startsWith(`${p}/`))) return [];
  return AD_PLACEMENTS.filter((pl) => pl.enabled)
    .filter((pl) => pl.pages.some((pg) => path === pg))
    .filter((pl) => pl.device === "all" || (pl.device === "mobile" ? isMobile : !isMobile))
    .filter((pl) => pl.format !== "rail" || wide)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, AD_RULES.maxSlotsPerPage);
}
