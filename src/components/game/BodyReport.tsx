"use client";
import { Badge, Card } from "@/components/ui";
import { recoveryRiskFactor, rushRiskWeeks } from "@/engine/career/recovery";
import { formatMoney } from "@/engine/players/economy";
import type { GameState } from "@/engine/types";

const CHOICE: Record<string, string> = { rush: "Rushed back", plan: "Medical plan", rest: "Full rest", clinic: "Specialist clinic", surgery: "Surgery", conservative: "No surgery", "fight-on": "Fought on" };

/** Injury history by body area and what the medical team think of the risk now. */
export function BodyReport({ g }: { g: GameState }) {
  const r = g.user.recovery;
  const areas = Object.entries(r?.areas ?? {}).sort((a, b) => b[1] - a[1]);
  const risk = recoveryRiskFactor(g);
  const rush = rushRiskWeeks(g);
  const recent = [...g.user.injuryHistory].slice(-4).reverse();
  return (
    <Card title="Body report">
      {!areas.length && !recent.length ? (
        <p className="text-sm text-ink-2">No injuries so far. Keep an eye on fitness and intense training streaks.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" aria-label="Injuries by body area">
            {areas.map(([area, n]) => (
              <Badge key={area} tone={n >= 3 ? "coral" : n === 2 ? "sun" : "paper"}>
                {area} ×{n}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-sm">
            Injury risk from your history:{" "}
            <b className={risk >= 1.5 ? "text-coral" : ""}>{risk <= 1.01 ? "normal" : `×${risk.toFixed(2)}`}</b>
            {rush > 0 && <> · rushed return, at risk for {rush} more week{rush === 1 ? "" : "s"}</>}
          </p>
          {r?.current && <p className="mt-1 text-xs text-muted">Last recovery: {r.current.type} ({CHOICE[r.current.choice] ?? r.current.choice}).</p>}
          {!!r?.clinics && <p className="mt-1 text-xs text-muted">Specialist clinics: {r.clinics} ({formatMoney(r.clinicSpent)}).</p>}
          {recent.length > 0 && (
            <ul className="mt-2 grid gap-0.5 text-xs text-ink-2">
              {recent.map((i, k) => (
                <li key={k}>
                  {i.season}: {i.type} · {i.weeks} week{i.weeks === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
