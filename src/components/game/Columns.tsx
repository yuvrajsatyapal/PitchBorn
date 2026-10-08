"use client";
import { useState } from "react";

export interface ColumnItem {
  key: string;
  label: string;
  /** Stacked segments, bottom first. */
  segments: { value: number; className: string }[];
  /** Shown in the detail strip on hover, focus or tap. */
  detail: string;
  /** A short value printed above the column. */
  top?: string;
}

/**
 * A small column chart in the game's flat style. Columns are buttons, so touch, mouse and keyboard all reach the
 * detail strip, which keeps its height so nothing shifts when it fills in.
 */
export function Columns({ items, max, height = 120, label, empty = "Nothing to chart yet." }: { items: ColumnItem[]; max?: number; height?: number; label: string; empty?: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (!items.length) return <p className="rounded-xl border-2 border-dashed border-line/40 p-3 text-xs text-muted">{empty}</p>;
  const top = max ?? Math.max(1, ...items.map((i) => i.segments.reduce((s, x) => s + x.value, 0)));
  return (
    <div>
      <div className="no-scrollbar overflow-x-auto pb-1">
        <div className="flex items-end gap-1 sm:gap-1.5" style={{ height, minWidth: Math.min(items.length * 28, 1200) }} role="group" aria-label={label}>
          {items.map((it, i) => {
            const total = it.segments.reduce((s, x) => s + x.value, 0);
            return (
              <button
                key={it.key}
                type="button"
                className="relative flex h-full min-w-[20px] flex-1 flex-col justify-end"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(active === i ? null : i)}
                aria-label={it.detail}
              >
                {it.top && <span className="pointer-events-none mb-0.5 text-center text-[9px] font-bold leading-none text-ink-2">{it.top}</span>}
                <span className={`flex w-full flex-col-reverse overflow-hidden rounded-t-md border-2 border-line ${active === i ? "ring-2 ring-sky" : ""}`} style={{ height: `${(total / top) * (height - 18)}px`, minHeight: total > 0 ? 4 : 0 }}>
                  {it.segments.map((s, k) => (
                    <span key={k} className={s.className} style={{ height: total ? `${(s.value / total) * 100}%` : 0 }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-1 sm:gap-1.5 pt-1 text-[9px] text-muted" style={{ minWidth: Math.min(items.length * 28, 1200) }} aria-hidden>
          {items.map((it) => (
            <span key={it.key} className="min-w-[20px] flex-1 truncate text-center">
              {it.label}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-1 min-h-[1.9rem] rounded-lg border-2 border-line/20 bg-paper-2/60 px-2 py-1 text-xs" aria-live="polite">
        {active !== null ? items[active].detail : <span className="text-muted">Tap or hover a column for the detail.</span>}
      </div>
    </div>
  );
}
