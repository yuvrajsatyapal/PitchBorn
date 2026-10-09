"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AD_PLACEMENTS, AD_RULES, placementsFor } from "./config";
import { useAds } from "./AdContext";

function useViewport() {
  const [vp, setVp] = useState({ mobile: false, wide: false, known: false });
  useEffect(() => {
    const update = () => setVp({ mobile: window.innerWidth < 768, wide: window.innerWidth >= AD_RULES.railMinViewport, known: true });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return vp;
}

type Variant = "inline" | "rail" | "mobile";

/**
 * Reserved, clearly-labelled ad container. Space is reserved up front to avoid
 * layout shift; if the provider can't fill (blocked, offline, no credentials)
 * the container collapses and the game carries on unaffected.
 */
export function AdSlot({ placementId, variant = "inline", className = "" }: { placementId: string; variant?: Variant; className?: string }) {
  const pathname = usePathname() ?? "/";
  const { provider, ready, suppressed } = useAds();
  const vp = useViewport();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"pending" | "filled" | "collapsed">("pending");
  const placement = AD_PLACEMENTS.find((p) => p.id === placementId);
  const allowed = vp.known && !!placement && placementsFor(pathname, vp.mobile, vp.wide).some((p) => p.id === placementId);

  useEffect(() => {
    const el = ref.current;
    if (!allowed || !placement || !el || suppressed) return;
    if (provider.id === "none" || !ready) return;
    let alive = true;
    const timeout = setTimeout(() => alive && setState((s) => (s === "pending" ? "collapsed" : s)), 8000);
    provider
      .render(el, placement)
      .then((r) => alive && setState(r === "filled" ? "filled" : "collapsed"))
      .catch(() => alive && setState("collapsed"));
    return () => {
      alive = false;
      clearTimeout(timeout);
      provider.destroy(el);
    };
  }, [allowed, placement, provider, ready, suppressed]);

  if (!placement || !allowed || suppressed || state === "collapsed" || provider.id === "none") return null;
  const placeholder = provider.id === "placeholder";
  return (
    <aside
      aria-label="Ad / Sponsor"
      data-ad-slot={placementId}
      className={`relative my-2 w-full ${variant === "rail" ? "sticky top-24" : ""} ${className}`}
      style={{ minHeight: placement.minHeight, maxWidth: placement.maxWidth }}
    >
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Ad / Sponsor</div>
      <div
        ref={ref}
        className="relative w-full overflow-hidden rounded-lg"
        style={{ minHeight: placement.minHeight - 18, background: placeholder ? "var(--ad-bg)" : undefined }}
      >
        {placeholder && (
          <div className="absolute inset-0 grid place-items-center border-2 border-dashed border-muted/60 text-center text-xs text-muted" style={{ borderRadius: 8 }}>
            <div>
              <div className="font-semibold">Ad / Sponsor placeholder</div>
              <div className="opacity-70">{placementId} · dev/test only</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export const InlineAdSlot = ({ placementId, className }: { placementId: string; className?: string }) => <AdSlot placementId={placementId} variant="inline" className={className} />;
export const ResponsiveAdSlot = InlineAdSlot;
export const SidebarAdSlot = ({ placementId = "rail-right" }: { placementId?: string }) => <AdSlot placementId={placementId} variant="rail" />;
export const MobileAdSlot = ({ placementId }: { placementId: string }) => (
  <div className="md:hidden">
    <AdSlot placementId={placementId} variant="mobile" />
  </div>
);
