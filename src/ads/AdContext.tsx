"use client";
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { consentRequired } from "./config";
import { readConsent, serverConsent, subscribeConsent, type ConsentState } from "./consent";
import { getAdProvider, type AdProvider } from "./providers";

interface AdCtx {
  provider: AdProvider;
  ready: boolean;
  consent: ConsentState;
  /** Game states that suppress ads (live match, decisions…). */
  suppressed: boolean;
  setSuppressed: (v: boolean) => void;
}

const Ctx = createContext<AdCtx | null>(null);

export function AdProviderRoot({ children }: { children: ReactNode }) {
  const provider = useMemo(() => getAdProvider(), []);
  const consent = useSyncExternalStore(subscribeConsent, readConsent, serverConsent);
  const [ready, setReady] = useState(false);
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Real providers wait for an explicit consent choice; failures never break the game.
    if (provider.real && consentRequired() && consent.status === "unknown") return;
    provider
      .init(consent)
      .then((ok) => !cancelled && setReady(ok))
      .catch(() => !cancelled && setReady(false));
    return () => {
      cancelled = true;
    };
  }, [provider, consent]);

  return <Ctx.Provider value={{ provider, ready, consent, suppressed, setSuppressed }}>{children}</Ctx.Provider>;
}

export function useAds(): AdCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAds outside AdProviderRoot");
  return c;
}

/** Mark a screen region as ad-free while mounted (e.g. live match). */
export function useSuppressAds(active = true) {
  const { setSuppressed } = useAds();
  useEffect(() => {
    if (!active) return;
    setSuppressed(true);
    return () => setSuppressed(false);
  }, [active, setSuppressed]);
}
