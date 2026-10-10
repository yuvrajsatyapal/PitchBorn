"use client";
import { useSyncExternalStore } from "react";
import { SPONSOR_EMAIL, SPONSOR_ROTATE_MS, SPONSOR_SECTIONS } from "./config";
import { useAds } from "./AdContext";

function sponsorHref(n: number) {
  const subject = encodeURIComponent(`Sponsor PitchBorn - Section ${n}`);
  const body = encodeURIComponent(`Hi,\n\nI'd like to sponsor Section ${n} on PitchBorn.\n\nCompany / brand:\nWebsite:\nBudget & dates:\n`);
  return `mailto:${SPONSOR_EMAIL}?subject=${subject}&body=${body}`;
}

function Section({ n, className = "" }: { n: number; className?: string }) {
  return (
    <div
      data-ad-section={n}
      className={`relative grid min-h-[120px] place-items-center rounded-lg border-2 border-dashed border-muted/60 text-center ${className}`}
      style={{ background: "var(--ad-bg)" }}
    >
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Section {n}</span>
        <a href={sponsorHref(n)} className="pb-hit rounded-full border-2 border-line bg-sun px-4 py-1.5 text-sm font-bold text-[#1b1712] shadow-[2px_2px_0_var(--shadow)]">
          Sponsor
        </a>
      </div>
    </div>
  );
}

function Grid({ className }: { className: string }) {
  return (
    <aside aria-label="Ad / Sponsor" className={className}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Ad / Sponsor</div>
      {SPONSOR_SECTIONS.map((n) => (
        <Section key={n} n={n} className="flex-1" />
      ))}
    </aside>
  );
}

/**
 * Wide screens: four equal sections pinned beside the content that stay put
 * while the page scrolls. Smaller screens have no spare side column, so the
 * same four sections flow in a 2x2 grid at the bottom of the page instead.
 */
export function SponsorRail() {
  const { suppressed } = useAds();
  if (suppressed) return null;
  return (
    <div className="hidden w-[300px] shrink-0 min-[1440px]:block">
      <Grid className="sticky top-[4.75rem] flex h-[calc(100dvh-5.75rem)] max-h-[900px] flex-col gap-3" />
    </div>
  );
}

/**
 * Small screens show exactly one sponsor section per page, picked at random.
 * It re-rolls every SPONSOR_ROTATE_MS, standing in for the future ad refetch.
 */
const listeners = new Set<() => void>();
const SERVER_PICK: number = SPONSOR_SECTIONS[0];
let pick: number = SERVER_PICK;
let timer: ReturnType<typeof setInterval> | undefined;

function randomSection(): number {
  const others = SPONSOR_SECTIONS.filter((n) => n !== pick);
  return others[Math.floor(Math.random() * others.length)];
}

function subscribePick(cb: () => void) {
  if (listeners.size === 0) {
    pick = randomSection();
    timer = setInterval(() => {
      pick = randomSection();
      listeners.forEach((l) => l());
    }, SPONSOR_ROTATE_MS);
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) clearInterval(timer);
  };
}

export function SponsorSlot({ className = "" }: { className?: string }) {
  const { suppressed } = useAds();
  const n = useSyncExternalStore(subscribePick, () => pick, () => SERVER_PICK);
  if (suppressed) return null;
  return (
    <aside aria-label="Ad / Sponsor" className={`min-[1440px]:hidden ${className}`}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Ad / Sponsor</div>
      <div data-ad-section={n} className="flex min-h-[96px] items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted/60 px-4 py-3" style={{ background: "var(--ad-bg)" }}>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Section {n}</span>
        <a href={sponsorHref(n)} className="pb-hit rounded-full border-2 border-line bg-sun px-4 py-1.5 text-sm font-bold text-[#1b1712] shadow-[2px_2px_0_var(--shadow)]">
          Sponsor
        </a>
      </div>
    </aside>
  );
}
