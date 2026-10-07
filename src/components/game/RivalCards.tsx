"use client";
import Link from "next/link";
import { Crest } from "@/components/art/Crest";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { Badge, Card } from "@/components/ui";
import { careerHonours } from "@/engine/awards/honours";
import { headToHeadLine, intensityLabel, primaryRival, rivalsByIntensity, storyline } from "@/engine/career/rivalry/engine";
import { clubName } from "@/engine/data/world";
import { ageOf } from "@/engine/players/generate";
import type { GameState, PlayerRival } from "@/engine/types";

export const rivalHref = (id: string) => `/play/rivalry/?id=${encodeURIComponent(id)}`;

export function IntensityBar({ value }: { value: number }) {
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full border border-line bg-paper-2" role="img" aria-label={`Rivalry: ${intensityLabel(value)}`}>
      <span className="block h-full rounded-full bg-coral" style={{ width: `${Math.max(6, Math.round(value))}%` }} />
    </span>
  );
}

const STATUS_TONE = { active: "coral", dormant: "paper", ended: "paper" } as const;
const STATUS_LABEL = { active: "Active", dormant: "Dormant", ended: "Over" } as const;

function RivalRow({ g, rv, main }: { g: GameState; rv: PlayerRival; main: boolean }) {
  const p = g.players[rv.playerId];
  return (
    <li>
      <Link href={rivalHref(rv.playerId)} className="flex items-center gap-3 rounded-xl border-2 border-line bg-card p-2.5 transition-colors hover:bg-paper-2" data-testid="rival-row">
        {p && <PlayerPortrait appearance={p.look} age={ageOf(p, g.season)} size={main ? 64 : 48} />}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 font-bold">
            {rv.name}
            {main && <Badge tone="coral">Main rival</Badge>}
            <Badge tone={STATUS_TONE[rv.status]}>{STATUS_LABEL[rv.status]}</Badge>
          </span>
          <span className="flex items-center gap-1.5 text-xs text-ink-2">
            {rv.clubId && <Crest clubId={rv.clubId} size={14} />}
            {rv.clubId ? clubName(rv.clubId, true) : "Free agent"} · {intensityLabel(rv.intensity)}
          </span>
          <span className="mt-1 block"><IntensityBar value={rv.intensity} /></span>
          <span className="mt-1 block text-xs text-ink-2">{headToHeadLine(rv)}</span>
          <span className="block text-xs font-semibold">{storyline(g, rv)}</span>
        </span>
        <span aria-hidden className="text-lg text-muted">›</span>
      </Link>
    </li>
  );
}

/** Profile card: the main rival and up to two minor ones. Hidden until a rivalry has actually emerged. */
export function RivalriesCard({ g }: { g: GameState }) {
  const all = rivalsByIntensity(g).filter((r) => r.status !== "ended");
  if (!all.length) return null;
  const main = primaryRival(g) ?? all[0];
  const ordered = [main, ...all.filter((r) => r !== main)].slice(0, 3);
  return (
    <Card title="Rivalries">
      <ul className="grid gap-2">
        {ordered.map((r) => (
          <RivalRow key={r.playerId} g={g} rv={r} main={r === main} />
        ))}
      </ul>
    </Card>
  );
}

/** Career history: every rivalry the career produced, including the ones that faded. */
export function RivalryHistoryCard({ g }: { g: GameState }) {
  const all = rivalsByIntensity(g);
  if (!all.length) return null;
  return (
    <Card title="Career rivals">
      <ul className="grid gap-2">
        {all.map((r) => (
          <RivalRow key={r.playerId} g={g} rv={r} main={false} />
        ))}
      </ul>
    </Card>
  );
}

/** Stats: the head-to-head numbers against the main rival. */
export function RivalStatsCard({ g }: { g: GameState }) {
  const rv = primaryRival(g) ?? rivalsByIntensity(g)[0];
  if (!rv || !rv.h2h.meetings) return null;
  const h = rv.h2h;
  return (
    <Card title={`Head to head: ${rv.name}`} action={<Link href={rivalHref(rv.playerId)} className="text-xs font-bold underline">Full rivalry ›</Link>}>
      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
        {[
          ["Meetings", h.meetings],
          ["Your wins", h.wins],
          ["Draws", h.draws],
          [`${rv.name.split(" ").slice(-1)[0]}'s wins`, h.losses],
          ["Goals (you–them)", `${h.myGoals}–${h.theirGoals}`],
        ].map(([label, v]) => (
          <div key={String(label)} className="rounded-xl border-2 border-line bg-card p-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</div>
            <div className="scoreboard text-xl">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Profile: the major season honours, counted. Hidden until there is something to show. */
export function HonoursCard({ g }: { g: GameState }) {
  const honours = careerHonours(g);
  if (!honours.length) return null;
  return (
    <Card title="Career honours" action={<Link href="/play/awards" className="text-xs font-bold underline">All awards ›</Link>}>
      <div className="flex flex-wrap gap-2">
        {honours.map((h) => (
          <Badge key={h.id} tone="plum">{h.count}× {h.name}</Badge>
        ))}
      </div>
    </Card>
  );
}
