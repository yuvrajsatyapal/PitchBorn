"use client";
import { Badge, Bar } from "@/components/ui";
import { describeMemory } from "@/engine/memory/describe";
import type { GameState, Memory } from "@/engine/types";

const TIER_TONE = { iconic: "sun", major: "plum", notable: "paper", minor: "paper" } as const;
const TIER_LABEL = { iconic: "Iconic", major: "Major", notable: "Notable", minor: "Minor" } as const;

/** One career memory: icon, title, a generated sentence and, when opened, how its importance was built. */
export function MemoryCard({ g, m, open, onToggle, big }: { g: GameState; m: Memory; open?: boolean; onToggle?: () => void; big?: boolean }) {
  const v = describeMemory(g, m);
  const tone = TIER_TONE[v.tier];
  const maxPts = Math.max(1, ...m.factors.map(([, p]) => Math.abs(p)));
  return (
    <li
      className={`rounded-2xl border-2 border-line p-3 ${v.tier === "iconic" ? "bg-sun-2 shadow-[3px_3px_0_var(--shadow)]" : "bg-card"} ${big ? "sm:p-4" : ""}`}
      data-testid="memory"
      data-kind={m.kind}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 text-left" aria-expanded={!!open}>
        <span className={`grid shrink-0 place-items-center rounded-xl border-2 border-line bg-card ${big ? "h-14 w-14 text-3xl" : "h-11 w-11 text-2xl"}`} aria-hidden>{v.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`font-display ${big ? "text-xl" : "text-lg"}`}>{v.title}</span>
            <Badge tone={tone}>{TIER_LABEL[v.tier]} · {m.importance}</Badge>
          </span>
          <span className="mt-0.5 block text-sm text-ink-2">{v.line}</span>
          <span className="mt-1 block text-xs text-muted">{v.ageLabel} · {v.seasonLabel}{m.compName && m.kind !== "trophy" ? ` · ${m.compName}` : ""}</span>
        </span>
      </button>
      {open && (
        <div className="mt-3 grid gap-3 border-t-2 border-dashed border-line pt-3 sm:grid-cols-2">
          <div className="text-xs text-ink-2">
            {v.details.map((d) => <p key={d}>{d}</p>)}
            {m.tags.length > 0 && <p className="mt-1 text-muted">{m.tags.map((t) => `#${t}`).join(" ")}</p>}
          </div>
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Why it matters</div>
            <div className="grid gap-1">
              {m.factors.map(([label, pts]) => (
                <Bar key={label} label={label} value={Math.max(0, pts)} max={maxPts} showValue={false} height={6} tone={pts < 0 ? "coral" : "pitch"} />
              ))}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
