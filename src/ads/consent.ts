/**
 * Consent integration point. This is NOT a certified consent management
 * platform. Before enabling personalised ads in the EEA/UK/Switzerland a
 * Google-certified (IAB TCF) CMP must be configured — see docs/ADVERTISING.md.
 * Without a choice we never load personalised advertising.
 */
export type ConsentStatus = "unknown" | "granted" | "denied";
export interface ConsentState {
  status: ConsentStatus;
  personalised: boolean;
  updatedAt?: string;
}

const KEY = "pb-ad-consent";
const UNKNOWN: ConsentState = { status: "unknown", personalised: false };
const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cacheVal: ConsentState = UNKNOWN;

/** Stable snapshot (safe for useSyncExternalStore). */
export function readConsent(): ConsentState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null; // storage blocked — treat as unknown
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cacheVal = raw ? (JSON.parse(raw) as ConsentState) : UNKNOWN;
    } catch {
      cacheVal = UNKNOWN;
    }
  }
  return cacheVal;
}

export const serverConsent = (): ConsentState => UNKNOWN;

export function writeConsent(c: ConsentState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...c, updatedAt: new Date().toISOString() }));
  } catch {
    /* non-fatal */
  }
  listeners.forEach((l) => l());
}

export function subscribeConsent(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
