"use client";
import { RewardedButton } from "@/ads/RewardedButton";
import { AttrValue, Badge, Card, PageTitle } from "@/components/ui";
import { BALANCE } from "@/engine/balance";
import { ATTR_LABEL } from "@/engine/players/attributes";
import { INTENSITY, TRAINING_FOCUS } from "@/engine/players/development";
import type { TrainingFocus } from "@/engine/types";
import { user } from "@/game/selectors";
import { useGame, useGameState } from "@/game/store";

export default function Training() {
  const g = useGameState();
  const setTraining = useGame((s) => s.setTraining);
  const grant = useGame((s) => s.grantReward);
  const notify = useGame((s) => s.notify);
  if (!g) return null;
  const p = user(g);
  const plan = g.user.training;
  const focuses = (Object.keys(TRAINING_FOCUS) as TrainingFocus[]).filter((f) => (p.position === "GK" ? f !== "finishing" : f !== "goalkeeping"));
  const boosts = g.user.boosts.filter((b) => b.untilTurnIndex >= g.turnIndex);
  const cd = (k: "training" | "recovery" | "morale", turns: number) => Math.max(0, turns - (g.turnIndex - (g.user.rewardCooldowns[k] ?? -999)));
  return (
    <div className="grid gap-4">
      <PageTitle kicker="Weekly plan" title="Training" />
      {p.injury && (
        <Card tone="coral">
          🩹 You&apos;re in rehab ({p.injury.type}, {p.injury.weeksLeft} week{p.injury.weeksLeft === 1 ? "" : "s"} left). Training resumes when you&apos;re fit.
        </Card>
      )}
      <Card title="Focus">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {focuses.map((f) => {
            const def = TRAINING_FOCUS[f];
            const active = plan.focus === f;
            return (
              <button key={f} onClick={() => setTraining({ ...plan, focus: f })} aria-pressed={active} className={`rounded-2xl border-2 border-line p-3 text-left transition ${active ? "bg-sun-2 shadow-[3px_3px_0_var(--shadow)]" : "bg-card hover:bg-paper-2"}`}>
                <div className="font-display text-lg">{def.label}</div>
                <div className="text-xs text-ink-2">{def.blurb}</div>
                {def.attrs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {def.attrs.map((a) => (
                      <span key={a} className="flex items-center gap-1 text-[11px]">
                        {ATTR_LABEL[a]} <AttrValue v={p.attrs[a]} />
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>
      <Card title="Intensity">
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(INTENSITY) as (keyof typeof INTENSITY)[]).map((k) => (
            <button key={k} onClick={() => setTraining({ ...plan, intensity: k })} aria-pressed={plan.intensity === k} className={`rounded-2xl border-2 border-line p-3 text-left ${plan.intensity === k ? "bg-sun-2 shadow-[3px_3px_0_var(--shadow)]" : "bg-card"}`}>
              <div className="font-display text-lg">{INTENSITY[k].label}</div>
              <div className="text-xs text-ink-2">
                Growth ×{INTENSITY[k].growth} · fatigue −{INTENSITY[k].fatigue} · injury risk ×{INTENSITY[k].injury}
              </div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-2">
          Fitness now: <b>{Math.round(p.fitness)}</b>. Intense weeks speed development but tired players get hurt more often. Mix in recovery weeks before big matches.
        </p>
        {g.user.lastTraining && <p className="mt-1 text-sm">Last week: {g.user.lastTraining.note}</p>}
      </Card>
      <Card title="Optional boosts">
        <p className="mb-3 text-sm text-ink-2">Small, temporary bonuses. Never required — the game is fully playable without them.</p>
        <div className="flex flex-wrap gap-4">
          <RewardedButton label="Focused session (+12% training, 2 wks)" hint={cd("training", BALANCE.rewards.trainingBoost.cooldownTurns) ? `Available in ${cd("training", BALANCE.rewards.trainingBoost.cooldownTurns)} weeks` : undefined} disabled={cd("training", BALANCE.rewards.trainingBoost.cooldownTurns) > 0} onReward={() => { const ok = grant("training"); if (ok) notify("Training boost active.", "good"); return ok; }} />
          <RewardedButton label="Physio session (+12 fitness)" disabled={cd("recovery", BALANCE.rewards.recoveryBoost.cooldownTurns) > 0} onReward={() => { const ok = grant("recovery"); if (ok) notify("Recovery boost active.", "good"); return ok; }} />
        </div>
        {boosts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {boosts.map((b) => (
              <Badge key={b.id} tone="plum">
                {b.kind} boost active
              </Badge>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
