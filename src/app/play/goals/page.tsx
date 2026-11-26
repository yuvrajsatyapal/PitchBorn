"use client";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { Boot, KitRoom } from "@/components/game/KitRoom";
import { Badge, Bar, Card, PageTitle } from "@/components/ui";
import { cosmeticDef, cosmeticsOf, equipCosmetic, goalProgress } from "@/engine/career/goals";
import { staticClub } from "@/engine/data/world";
import { age, user } from "@/game/selectors";
import { useGame, useGameState } from "@/game/store";

export default function GoalsPage() {
  const g = useGameState();
  const act = useGame((s) => s.act);
  if (!g) return null;
  const p = user(g);
  const goals = g.user.goals;
  const c = g.user.cosmetics ?? { owned: [], equipped: {} };
  const club = p.clubId ? staticClub(p.clubId)?.colors : undefined;
  const kitDef = cosmeticDef(c.equipped.kit);
  const kit = kitDef?.colors ? { primary: kitDef.colors[0], secondary: kitDef.colors[1] } : club ? { primary: club.primary, secondary: club.secondary } : undefined;
  const boots = cosmeticDef(c.equipped.boots)?.colors ?? ["#1b1712", "#f4efe2"];
  const cel = cosmeticDef(c.equipped.celebration);
  return (
    <div className="grid gap-4">
      <PageTitle kicker="Rewards" title="Goals & Kit Room">
        Three small goals at a time. Each one you finish unlocks boots, a kit colour or a goal celebration.
      </PageTitle>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card title="This week's goals" action={<Badge tone="pitch">{goals?.completed ?? 0} completed</Badge>}>
          {goals?.active.length ? (
            <ul className="grid gap-3">
              {goals.active.map((goal) => {
                const done = goalProgress(g, goal);
                const reward = cosmeticDef(goal.reward);
                const weeks = Math.max(0, goal.expiresIndex - g.turnIndex);
                return (
                  <li key={goal.id} className="rounded-xl border-2 border-line p-3" data-testid="goal">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b>{goal.label}</b>
                      <span className="text-xs text-muted">{weeks} week{weeks === 1 ? "" : "s"} left</span>
                    </div>
                    <div className="mt-2">
                      <Bar value={done} max={goal.target} label={`${done} of ${goal.target}`} tone={done >= goal.target ? "pitch" : "sun"} showValue={false} />
                    </div>
                    {reward && <div className="mt-1 text-xs text-ink-2">Reward: {reward.icon ?? ""} {reward.name} ({reward.kind})</div>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">Goals appear once you press Continue.</p>
          )}
        </Card>
        <Card title="Kit Room">
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <PlayerPortrait appearance={p.look} age={age(g, p)} size={104} kit={kit} />
            <div className="grid gap-1 text-sm">
              <Boot colors={boots as [string, string]} size={72} />
              {cel && <span>{cel.icon} {cel.name}</span>}
            </div>
          </div>
          <KitRoom owned={c.owned} equipped={c.equipped} newly={c.newly} clubKit={club?.primary} onEquip={(id) => act((gm) => { cosmeticsOf(gm); return equipCosmetic(gm, id); })} />
        </Card>
      </div>
    </div>
  );
}
