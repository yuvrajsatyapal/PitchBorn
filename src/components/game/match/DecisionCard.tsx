"use client";
import { useEffect, useRef } from "react";
import { Card } from "@/components/ui";
import type { MatchEngine } from "@/engine/match/engine";
import { riskOf } from "@/engine/match/moments";

const RISK_CLASS = { Safe: "bg-pitch-2", Balanced: "bg-sun-2", Risky: "bg-coral-2" } as const;

/** A key moment. The player sees what each choice is, which abilities it leans on and roughly how risky it is, never a probability. */
export function DecisionCard({ eng, onResolve }: { eng: MatchEngine; onResolve: (id: string) => void }) {
  const d = eng.pending;
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (d) first.current?.focus({ preventScroll: false });
  }, [d]);
  if (!d) return null;
  return (
    <Card tone="sun" className="anim-pop border-[3px]" >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-black uppercase tracking-widest">{d.moment ?? "Key moment"} · {d.minute}&apos;</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-2">Match paused</div>
      </div>
      <p className="my-2 font-display text-xl leading-tight sm:text-2xl" data-testid="decision-prompt">{d.prompt}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {d.options.map((o, i) => {
          const label = riskOf(o.odds);
          return (
            <button key={o.id} ref={i === 0 ? first : undefined} className="pb-btn flex-col items-start gap-1 bg-card px-4 py-2.5 text-left" onClick={() => onResolve(o.id)} data-testid="decision-option">
              <span className="flex w-full items-start justify-between gap-2">
                <span className="font-bold">{o.label}</span>
                <span className={`shrink-0 rounded-full border-2 border-line px-2 py-0.5 text-[11px] font-black ${RISK_CLASS[label]}`} data-testid="risk">{label}</span>
              </span>
              <span className="text-xs font-normal text-ink-2">{o.detail}</span>
              {o.skills && o.skills.length > 0 && <span className="text-[11px] font-semibold text-muted">{o.skills.slice(0, 3).join(" · ")}</span>}
              {o.suits && <span className="text-[11px] font-black text-pitch">★ Suits your game</span>}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
