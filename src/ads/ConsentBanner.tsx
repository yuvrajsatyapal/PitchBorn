"use client";
import { useSyncExternalStore } from "react";
import { consentRequired } from "./config";
import { readConsent, serverConsent, subscribeConsent, writeConsent } from "./consent";
import { useAds } from "./AdContext";

/**
 * Consent integration point shown only when a real ad provider is configured.
 * It records a choice and gates ad loading; production deployments in regions
 * that require it must swap this for a certified CMP (see docs/ADVERTISING.md).
 */
export function ConsentBanner() {
  const { provider } = useAds();
  const consent = useSyncExternalStore(subscribeConsent, readConsent, serverConsent);
  const show = provider.real && consentRequired() && consent.status === "unknown";
  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-h-[70dvh] max-w-xl overflow-y-auto lg:bottom-4" role="dialog" aria-label="Ad and sponsor preferences">
      <div className="pb-card p-4 text-sm">
        <p className="mb-3">
          Pitchborn is free and supported by ads and sponsors. Choose whether ads may be personalised. The game works fully either way.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="pb-btn bg-card px-4" onClick={() => writeConsent({ status: "denied", personalised: false })}>
            Non-personalised only
          </button>
          <button className="pb-btn bg-sun px-4" onClick={() => writeConsent({ status: "granted", personalised: true })}>
            Allow personalised
          </button>
        </div>
      </div>
    </div>
  );
}
