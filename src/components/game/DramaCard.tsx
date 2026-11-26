"use client";
import { Badge, Card } from "@/components/ui";
import { TITLES, raceProgress } from "@/engine/career/drama";
import type { GameState } from "@/engine/types";
import { fullName } from "@/engine/world/helpers";

/** The running off-pitch story, the captaincy race meter, and how past stories ended. */
export function DramaCard({ g }: { g: GameState }) {
  const d = g.user.drama;
  const s = d?.active;
  const race = raceProgress(g);
  const waiting = g.user.decisions.some((x) => x.handler === "drama");
  const log = [...(d?.log ?? [])].reverse().slice(0, 4);
  return (
    <Card title="Off the pitch" action={s ? <Badge tone="coral">{TITLES[s.kind]}</Badge> : undefined}>
      {!s && !log.length && <p className="text-sm text-ink-2">All quiet. Stand-offs, cliques, rows with the manager and captaincy races play out here.</p>}
      {s && (
        <p className="text-sm">
          {waiting ? "A decision is waiting for you on the dashboard." : "The story is still unfolding."}
          {s.kind === "clique" && s.camps && <> Camps: <b>{s.camps.a.name}</b> v <b>{s.camps.b.name}</b>.</>}
        </p>
      )}
      {race && (
        <div className="mt-2" aria-label={`Captaincy race: you ${race.you}%, ${fullName(g.players[race.rivalId])} ${100 - race.you}%`}>
          <div className="flex justify-between text-xs font-bold">
            <span>You {race.you}%</span>
            <span>{g.players[race.rivalId]?.lastName} {100 - race.you}%</span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-line bg-card">
            <div className="h-full bg-pitch" style={{ width: `${race.you}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted">Decided in {race.weeksLeft} week{race.weeksLeft === 1 ? "" : "s"}: form and the dressing room count.</div>
        </div>
      )}
      {log.length > 0 && (
        <ul className="mt-3 grid gap-1 text-xs text-ink-2">
          {log.map((l, i) => (
            <li key={i}>
              <b>{l.season}</b> · {l.title}: {l.outcome}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
