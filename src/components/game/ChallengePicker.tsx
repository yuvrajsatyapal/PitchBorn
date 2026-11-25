"use client";
import { Badge } from "@/components/ui";
import { CHALLENGES, challengeFits, weeklyChallenge } from "@/engine/career/challenges";
import type { StartPath } from "@/engine/world/create";

export interface ChallengePick {
  id: string;
  weekly?: string;
  seed?: string;
}

/** New-career confirm step: play this week's shared challenge, another scenario, or none. */
export function ChallengePicker({ value, onChange, start }: { value: ChallengePick | null; onChange: (v: ChallengePick | null) => void; start: { path: StartPath; tier: number; position: string } }) {
  const weekly = weeklyChallenge(new Date());
  const rows = [{ def: weekly.def, weekly: true }, ...CHALLENGES.filter((c) => c.id !== weekly.def.id).map((def) => ({ def, weekly: false }))];
  const btn = (on: boolean, disabled = false) => `w-full rounded-xl border-2 border-line p-2.5 text-left ${on ? "bg-sun-2 shadow-[2px_2px_0_var(--shadow)]" : "bg-card hover:bg-paper-2"} ${disabled ? "opacity-50" : ""}`;
  return (
    <div className="mt-4" data-testid="challenge-picker">
      <div className="text-sm font-bold">Challenge (optional)</div>
      <p className="text-xs text-ink-2">A goal to chase, checked every week. The weekly challenge gives everyone who starts it this week the same world.</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        <li>
          <button className={btn(!value)} onClick={() => onChange(null)} aria-pressed={!value}>
            <div className="font-bold">No challenge</div>
            <div className="text-xs text-ink-2">Just play your career.</div>
          </button>
        </li>
        {rows.map(({ def, weekly: isWeekly }) => {
          const fit = challengeFits(def, start);
          const on = value?.id === def.id && !!value.weekly === isWeekly;
          return (
            <li key={`${def.id}-${isWeekly}`}>
              <button className={btn(on, !fit.ok)} disabled={!fit.ok} aria-pressed={on} onClick={() => onChange(isWeekly ? { id: def.id, weekly: weekly.week, seed: weekly.seed } : { id: def.id })}>
                <div className="flex flex-wrap items-center gap-1.5 font-bold">
                  <span aria-hidden>{def.icon}</span> {def.title} {isWeekly && <Badge tone="sun">This week · {weekly.week}</Badge>}
                </div>
                <div className="text-xs text-ink-2">{def.blurb}</div>
                {!fit.ok && <div className="mt-0.5 text-[11px] font-bold text-coral">{fit.reason}</div>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
