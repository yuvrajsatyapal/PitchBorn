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
    <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-xl md:bottom-4" role="dialog" aria-label="Advertising preferences">
      <div className="pb-card p-4 text-sm">
        <p className="mb-3">
          Pitchborn is free and supported by ads. Choose whether ads may be personalised. The game works fully either way.
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
