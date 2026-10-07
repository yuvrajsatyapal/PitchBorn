"use client";
import Link from "next/link";
import { Crest } from "@/components/art/Crest";
import { Flag } from "@/components/art/Flag";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { Badge, Bar, Button, Card, FormDots, Rating } from "@/components/ui";
import { formatTurnDate } from "@/engine/calendar";
import { clubName, staticClub } from "@/engine/data/world";
import { POSITION_LABEL } from "@/engine/players/attributes";
import { formatMoney } from "@/engine/players/economy";
import { Rng } from "@/engine/rng";
import type { Competition, Fixture, GameState, Player, TableRow } from "@/engine/types";
import { age, name, ovr, resultFor, scoreText, teamLabel } from "@/game/selectors";
import { useGame } from "@/game/store";

/** Scout's estimate of potential — honest-ish, fuzzier for younger players. */
export function scoutStars(g: GameState, p: Player): number {
  const a = age(g, p);
  const r = Rng.fromSeed(`${p.id}:scout:${g.season}`);
  const est = p.hidden.potential + r.normal(0, a < 20 ? 4 : a < 24 ? 2.5 : 1.2);
  return Math.max(1, Math.min(5, Math.round(((est - 55) / 8) * 2) / 2));
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex text-base leading-none" role="img" aria-label={`${value} of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-block text-paper-2" aria-hidden>
            ★&#xFE0E;
            {fill > 0 && (
              <span className="absolute inset-y-0 left-0 overflow-hidden text-sun [text-shadow:1px_1px_0_var(--line)]" style={{ width: `${fill * 100}%` }}>
                ★&#xFE0E;
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function PlayerHero({ g, p }: { g: GameState; p: Player }) {
  const kit = staticClub(p.clubId ?? "")?.colors.primary ?? "#2e8b57";
  return (
    <Card className="bg-sun-2" flat={false}>
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="sm:hidden"><PlayerPortrait appearance={p.look} age={age(g, p)} size={72} kit={kit} /></span>
        <span className="hidden sm:block"><PlayerPortrait appearance={p.look} age={age(g, p)} size={104} kit={kit} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <h1 className="font-display text-2xl leading-tight sm:text-4xl">{name(p)}</h1>
            <Flag code={p.nationality} className="text-lg" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
            <span>{POSITION_LABEL[p.position]}</span>
            <span>Age {age(g, p)}</span>
          </div>
          <div className="mt-1 hidden items-center gap-1 text-sm text-ink-2 sm:flex">
            <Crest clubId={p.clubId} size={18} /> {clubName(p.clubId)}
            {p.loan && <Badge tone="sky">on loan</Badge>}
          </div>
        </div>
        <div className="shrink-0 text-center">
          <div className="text-[11px] font-black uppercase tracking-widest text-muted">Overall</div>
          <div className="scoreboard rounded-xl border-2 border-line bg-[#1b1712] px-3 py-1 text-3xl text-[#ffc62b] sm:text-4xl" data-testid="overall">
            {ovr(p)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="flex items-center gap-1 text-ink-2 sm:hidden">
          <Crest clubId={p.clubId} size={18} /> {clubName(p.clubId)}
          {p.loan && <Badge tone="sky">on loan</Badge>}
        </span>
        <Badge tone="paper">Value {formatMoney(p.value)}</Badge>
        {p.contract && <Badge tone="paper">{formatMoney(p.contract.wage)}/wk · until {p.contract.expires + 1}</Badge>}
        <Badge tone="paper">
          Potential <Stars value={scoutStars(g, p)} />
        </Badge>
        {p.injury && <Badge tone="coral">🩹 {p.injury.type} · {p.injury.weeksLeft}w</Badge>}
        {p.suspension > 0 && <Badge tone="coral">Suspended {p.suspension}</Badge>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Bar label="Fitness" value={p.fitness} tone={p.fitness < 70 ? "coral" : p.fitness < 85 ? "sun" : "pitch"} />
        <Bar label="Morale" value={p.morale} tone={p.morale < 45 ? "coral" : "sky"} />
        <Bar label="Sharpness" value={p.sharpness} tone="sun" />
        <Bar label="Form" value={(p.form - 4) * (100 / 6)} tone="plum" showValue={false} />
      </div>
    </Card>
  );
}

export function FixtureRow({ comp, f, teamId, compact }: { comp: Competition; f: Fixture; teamId: string; compact?: boolean }) {
  const g = useGame((s) => s.game);
  const home = f.home === teamId;
  const opp = home ? f.away : f.home;
  const res = resultFor(f, teamId);
  return (
    <li className="flex items-center gap-2.5 py-1.5 text-sm">
      <span className="w-14 shrink-0 text-[11px] text-muted">{g ? formatTurnDate(g.season, f.turn).replace(/ \d{4}$/, "") : `W${f.turn}`}</span>
      <Crest clubId={opp} size={22} />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold">{teamLabel(opp, compact)}</span> <span className="text-muted">({home ? "H" : "A"})</span>
        {!compact && <span className="ml-1 text-xs text-muted">· {comp.shortName}{f.stage ? ` ${f.stage}` : ""}</span>}
      </span>
      {f.result ? (
        <span className={`rounded-md border-2 border-line px-1.5 text-xs font-black tabular-nums ${res === "W" ? "bg-pitch text-white" : res === "L" ? "bg-coral" : "bg-sun"}`}>{scoreText(f)}</span>
      ) : (
        <span className="text-xs font-bold text-muted">{comp.shortName}</span>
      )}
    </li>
  );
}

export function MiniTable({ table, highlight, around = 3, promo = 0, releg = 0 }: { table: TableRow[]; highlight?: string; around?: number; promo?: number; releg?: number }) {
  const idx = table.findIndex((r) => r.team === highlight);
  const rows = idx < 0 ? table.slice(0, around * 2 + 1) : table.slice(Math.max(0, Math.min(idx - around, table.length - around * 2 - 1)), Math.max(0, Math.min(idx - around, table.length - around * 2 - 1)) + around * 2 + 1);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[11px] uppercase text-muted">
          <th className="w-6 text-left">#</th>
          <th className="text-left">Club</th>
          <th className="w-8 text-right">P</th>
          <th className="w-10 text-right">GD</th>
          <th className="w-10 text-right">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const pos = table.indexOf(r) + 1;
          return (
            <tr key={r.team} className={r.team === highlight ? "bg-sun-2 font-bold" : ""}>
              <td className={`py-1 ${pos <= promo ? "text-pitch" : pos > table.length - releg ? "text-coral" : ""}`}>{pos}</td>
              <td className="max-w-0 truncate py-1">
                <span className="flex items-center gap-1.5">
                  <Crest clubId={r.team} size={18} /> <span className="truncate">{teamLabel(r.team, true)}</span>
                </span>
              </td>
              <td className="text-right tabular-nums">{r.played}</td>
              <td className="text-right tabular-nums">{r.gf - r.ga > 0 ? `+${r.gf - r.ga}` : r.gf - r.ga}</td>
              <td className="text-right font-bold tabular-nums">{r.points}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function PendingMatchCard({ g }: { g: GameState }) {
  const sim = useGame((s) => s.simMatch);
  const busy = useGame((s) => s.busy);
  if (!g.pending.length) return null;
  const pm = g.pending[0];
  const comp = g.competitions[pm.compId];
  const f = comp?.fixtures.find((x) => x.id === pm.fixtureId);
  if (!comp || !f) return null;
  return (
    <Card tone="coral" className="anim-slide">
      <div className="text-[11px] font-black uppercase tracking-widest">Match day · {comp.name}{f.stage ? ` · ${f.stage}` : ""}</div>
      <div className="my-3 flex items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <Crest clubId={f.home} size={54} />
          <span className="text-sm font-bold">{teamLabel(f.home, true)}</span>
        </div>
        <span className="scoreboard text-2xl">VS</span>
        <div className="flex flex-col items-center gap-1 text-center">
          <Crest clubId={f.away} size={54} />
          <span className="text-sm font-bold">{teamLabel(f.away, true)}</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/play/match" className="pb-btn bg-sun px-5 text-[#1b1712]" data-testid="play-live">
          ▶ Play live
        </Link>
        <Button tone="paper" onClick={() => sim(f.id)} disabled={!!busy} data-testid="quick-sim">
          Quick sim
        </Button>
      </div>
    </Card>
  );
}

export function DecisionCards({ g }: { g: GameState }) {
  const decide = useGame((s) => s.decide);
  if (!g.user.decisions.length) return null;
  return (
    <>
      {g.user.decisions.map((d) => (
        <Card key={d.id} tone="plum" title={d.title}>
          <p className="mb-3 text-sm">{d.body}</p>
          <div className="flex flex-wrap gap-2">
            {d.options.map((o) => (
              <button key={o.id} onClick={() => decide(d.id, o.id)} className="pb-btn bg-card px-3 text-left text-sm">
                <span>
                  {o.label}
                  {o.hint && <span className="block text-[11px] font-normal text-muted">{o.hint}</span>}
                </span>
              </button>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}

export function TeamForm({ form }: { form: ("W" | "D" | "L")[] }) {
  return form.length ? <FormDots form={form.slice(-5)} /> : <span className="text-xs text-muted">No games yet</span>;
}

export { Rating };
