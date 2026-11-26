"use client";
import { Badge, Button, Card } from "@/components/ui";
import { activeRole, clearRole, requestRole, roleOptions } from "@/engine/career/roles";
import type { GameState } from "@/engine/types";
import { useGame } from "@/game/store";

const fitLabel = (f: number) => (f >= 3 ? { t: "Suits you", tone: "pitch" as const } : f >= -3 ? { t: "Workable", tone: "sun" as const } : { t: "Poor fit", tone: "coral" as const });

/** Choose a tactical role with the manager: each one changes where your involvement comes from. */
export function TacticalRoleCard({ g }: { g: GameState }) {
  const act = useGame((s) => s.act);
  const me = g.players[g.user.playerId];
  if (!me?.clubId || g.user.retired) return null;
  const opts = roleOptions(g);
  if (!opts.length) return null;
  const current = activeRole(g);
  return (
    <Card title="Tactical role" action={current ? <Badge tone="sun">{current.name}</Badge> : <Badge>Manager&apos;s default</Badge>} data-testid="tactical-role">
      <p className="mb-3 text-sm text-ink-2">Agree a role with the manager. It changes what you do on the ball, how your rating builds and, when it suits you and the team, how often you start.</p>
      <ul className="grid gap-2">
        {opts.map(({ def, fit, style, active }) => {
          const f = fitLabel(fit);
          return (
            <li key={def.id} className={`rounded-xl border-2 border-line p-2.5 ${active ? "bg-sun-2" : "bg-card"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b>{def.name}</b>
                <span className="flex flex-wrap gap-1">
                  <Badge tone={f.tone}>{f.t}</Badge>
                  {style > 0.3 && <Badge tone="pitch">Fits the team</Badge>}
                  {style < -0.3 && <Badge tone="coral">Clashes with the style</Badge>}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-2">{def.blurb}</p>
              {!active && (
                <Button size="sm" tone="paper" className="mt-2" onClick={() => act((gm) => requestRole(gm, def.id))}>
                  Ask to play this role
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {current && (
        <Button size="sm" tone="paper" className="mt-3" onClick={() => act((gm) => clearRole(gm), "Back to the manager's default instructions.")}>
          Go back to the default role
        </Button>
      )}
    </Card>
  );
}
