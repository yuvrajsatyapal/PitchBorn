"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SponsorSlot } from "@/ads/SponsorSections";

type Tone = "sun" | "pitch" | "plum" | "coral" | "sky" | "paper" | "ink";
const TONE_BG: Record<Tone, string> = {
  sun: "bg-sun text-[#1b1712]",
  pitch: "bg-pitch text-white",
  plum: "bg-plum text-white",
  coral: "bg-coral text-[#1b1712]",
  sky: "bg-sky text-white",
  paper: "bg-card text-ink",
  ink: "bg-ink text-paper",
};
const TONE_SOFT: Record<Tone, string> = {
  sun: "bg-sun-2 text-ink",
  pitch: "bg-pitch-2 text-ink",
  plum: "bg-plum-2 text-ink",
  coral: "bg-coral-2 text-ink",
  sky: "bg-sky-2 text-ink",
  paper: "bg-paper-2 text-ink",
  ink: "bg-ink text-paper",
};

export function Button({
  tone = "sun",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "px-3 text-sm min-h-[40px]" : size === "lg" ? "px-7 text-lg py-3" : "px-5 text-[15px]";
  return (
    <button className={`pb-btn ${TONE_BG[tone]} ${sz} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({ href, tone = "sun", size = "md", className = "", children }: { href: string; tone?: Tone; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode }) {
  const sz = size === "sm" ? "px-3 text-sm min-h-[40px]" : size === "lg" ? "px-7 text-lg py-3" : "px-5 text-[15px]";
  return (
    <Link href={href} className={`pb-btn ${TONE_BG[tone]} ${sz} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({ children, className = "", tone, title, action, flat }: { children: ReactNode; className?: string; tone?: Tone; title?: ReactNode; action?: ReactNode; flat?: boolean }) {
  return (
    <section className={`${flat ? "pb-card-flat" : "pb-card"} ${tone ? TONE_SOFT[tone] : ""} p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {title && <h2 className="font-display text-xl leading-none">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "paper", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border-2 border-line px-2 py-0.5 text-xs font-bold ${TONE_SOFT[tone]} ${className}`}>{children}</span>;
}

const COMP_TONE: Record<string, Tone> = { league: "pitch", cup: "sun", continental: "plum", international: "sky", friendly: "paper" };
const STAGE_SHORT: Record<string, string> = { "Quarter-final": "QF", "Semi-final": "SF", "Round of 16": "R16", "Group stage": "Groups" };

/** Competition tag: a colour-coded code chip by kind, with the stage (Group B, QF…) as quiet text beside it. */
export function CompChip({ comp, stage, stacked, full, hideOnMobile, className = "" }: { comp: { kind: string; shortName: string; name: string }; stage?: string | null; stacked?: boolean; full?: boolean; hideOnMobile?: boolean; className?: string }) {
  const label = stage ? (stacked ? stage : (STAGE_SHORT[stage] ?? stage)) : null;
  return (
    <span title={stage ? `${comp.name} · ${stage}` : comp.name} className={`${hideOnMobile ? "max-sm:hidden sm:inline-flex" : "inline-flex"} min-w-0 ${stacked ? "flex-row items-center gap-2" : "items-center gap-1.5"} ${className}`}>
      <span className={`max-w-full shrink-0 truncate rounded-md border-2 border-line px-1.5 text-[10px] font-black leading-4 tracking-wide sm:text-[11px] sm:leading-5 ${comp.kind === "league" || comp.kind === "friendly" ? "bg-paper-2 text-ink-2" : TONE_BG[COMP_TONE[comp.kind] ?? "paper"]}`}>{full ? comp.name : comp.shortName}</span>
      {label && <span className="truncate text-[11px] font-semibold leading-none text-muted">{label}</span>}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className={`flex h-full flex-col justify-center rounded-xl border-2 border-line px-3 py-2 ${tone ? TONE_SOFT[tone] : "bg-card"}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="num text-2xl leading-tight">{value}</div>
      {sub && <div className="text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export function Bar({ value, max = 100, tone = "pitch", label, showValue = true, height = 10 }: { value: number; max?: number; tone?: Tone; label?: string; showValue?: boolean; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between text-xs font-semibold">
          <span>{label}</span>
          {showValue && <span className="tabular-nums">{Math.round(value)}</span>}
        </div>
      )}
      <div className="overflow-hidden rounded-full border-2 border-line bg-paper-2" style={{ height }} role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className={`h-full ${TONE_BG[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AttrValue({ v }: { v: number }) {
  const r = Math.round(v);
  const cls = r >= 85 ? "bg-pitch text-white" : r >= 75 ? "bg-pitch-2" : r >= 65 ? "bg-sun-2" : r >= 50 ? "bg-paper-2" : "bg-coral-2";
  return <span className={`inline-block min-w-[2.2rem] rounded-md border-2 border-line px-1 text-center text-sm font-bold tabular-nums ${cls}`}>{r}</span>;
}

export function Rating({ v, size = "md" }: { v: number | undefined; size?: "sm" | "md" }) {
  if (v === undefined || Number.isNaN(v)) return <span className="text-muted">–</span>;
  const cls = v >= 8 ? "bg-pitch text-white" : v >= 7 ? "bg-pitch-2" : v >= 6.3 ? "bg-sun-2" : "bg-coral-2";
  return <span className={`inline-block rounded-md border-2 border-line text-center font-bold tabular-nums ${cls} ${size === "sm" ? "min-w-[2.4rem] text-xs" : "min-w-[2.8rem] px-1 text-sm"}`}>{v.toFixed(1)}</span>;
}

export function Tabs<T extends string>({ value, onChange, items, className = "", compact }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[]; className?: string; compact?: boolean }) {
  return (
    <div role="tablist" className={`no-scrollbar flex ${compact ? "gap-1.5 sm:gap-2" : "gap-2"} overflow-x-auto pb-1 ${className}`}>
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={`shrink-0 rounded-full border-2 border-line ${compact ? "px-2.5 py-1 text-xs sm:px-3.5 sm:py-2 sm:text-sm" : "px-3.5 py-2 text-sm"} font-bold transition ${value === it.id ? "bg-ink text-paper" : "bg-card hover:bg-paper-2"}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children, icon = "⚽" }: { title: string; children?: ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line/50 px-4 py-8 text-center">
      <div className="text-3xl" aria-hidden>
        {icon}
      </div>
      <div className="font-display text-lg">{title}</div>
      {children && <div className="max-w-sm text-sm text-ink-2">{children}</div>}
    </div>
  );
}

export function PageTitle({ kicker, title, children, className = "mb-5" }: { kicker?: string; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <>
      <div className={`${className} flex flex-wrap items-end justify-between gap-3`}>
        <div>
          {kicker && <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{kicker}</div>}
          <h1 className="font-display text-3xl leading-none sm:text-4xl">{title}</h1>
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
      <SponsorSlot className="mb-5" />
    </>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  // Rendered into <body>: inside a parent with backdrop-filter (the sticky top bar) `position: fixed` is relative to
  // that parent, not the viewport, which clips the dialog.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`pb-card anim-pop max-h-[92dvh] w-full overflow-y-auto rounded-b-none overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-b-[1.1rem] sm:p-5 ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl leading-none">{title}</h2>
          <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-line bg-paper-2 text-lg font-bold leading-none" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Sparkline({ values, height = 36, width = 160, min = 4, max = 10 }: { values: number[]; height?: number; width?: number; min?: number; max?: number }) {
  if (values.length < 2) return <div className="text-xs text-muted">Not enough matches yet</div>;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 6) + 3, height - 3 - ((v - min) / (max - min)) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const mid = height - 3 - ((6.6 - min) / (max - min)) * (height - 6);
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }} role="img" aria-label="Recent match ratings">
      <line x1="0" x2={width} y1={mid} y2={mid} stroke="var(--muted)" strokeDasharray="3 3" strokeWidth="1" />
      <path d={d} fill="none" stroke="var(--pitch)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.4" fill={values[i] >= 7.5 ? "var(--pitch)" : values[i] < 6 ? "var(--coral)" : "var(--ink)"} />
      ))}
    </svg>
  );
}

export function FormDots({ form }: { form: ("W" | "D" | "L")[] }) {
  return (
    <span className="inline-flex gap-1" aria-label={`Form ${form.join(" ")}`}>
      {form.map((f, i) => (
        <span key={i} className={`grid h-5 w-5 place-items-center rounded-md border-2 border-line text-[11px] font-black ${f === "W" ? "bg-pitch text-white" : f === "D" ? "bg-sun" : "bg-coral"}`}>
          {f}
        </span>
      ))}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl border-2 border-line/30 bg-paper-2 ${className}`} />;
}

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-xl border-2 border-line ${className}`}>
      <table className="w-full min-w-max border-collapse text-sm [&_td]:border-t [&_td]:border-line/15 [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:bg-paper-2 [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left [&_th.text-right]:text-right [&_th.text-center]:text-center [&_th]:text-[11px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wider [&_tbody_tr:hover]:bg-paper-2/60">
        {children}
      </table>
    </div>
  );
}

/** A card section that can be folded away, so a busy page stays calm. Content is only rendered while it is open. */
export function Disclosure({ title, summary, children, defaultOpen = false, className = "" }: { title: ReactNode; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`pb-card p-4 sm:p-5 ${className}`}>
      <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <span className="font-display text-xl leading-none">{title}</span>
          {summary && <span className="mt-1 block text-xs text-muted">{summary}</span>}
        </span>
        <span aria-hidden className="text-lg">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}
