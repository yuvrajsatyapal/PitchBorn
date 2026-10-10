"use client";
import Link from "next/link";
import { useState } from "react";
import { Crest } from "@/components/art/Crest";
import { clubKit } from "@/components/art/clubKit";
import { Flag } from "@/components/art/Flag";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { Badge, Bar, Button, Card, CompChip, FormDots, LinkButton, Rating } from "@/components/ui";
import { formatTurnDate, seasonLabel } from "@/engine/calendar";
import { clubName } from "@/engine/data/world";
import { POSITION_LABEL } from "@/engine/players/attributes";
import { formatMoney } from "@/engine/players/economy";
import { Rng } from "@/engine/rng";
import { ShirtNo } from "@/components/game/NumberPicker";
import { intlTeam } from "@/engine/national/identity";
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

export function Stars({ value, className = "text-base" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex leading-none ${className}`} role="img" aria-label={`${value} of 5 stars`}>
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

/** 0-100 rating on a 1-5 half-star scale. */
const ratingStars = (v: number) => Math.max(0.5, Math.min(5, Math.round((v / 20) * 2) / 2));

export function SkillStarsGroup({ p, className = "" }: { p: Player; className?: string }) {
  return (
    <div className={`mb-4 break-inside-avoid ${className}`}>
      <h3 className="mb-1 text-xs font-black uppercase tracking-wider text-muted">Skills</h3>
      <ul className="grid gap-1">
        <li className="flex items-center justify-between text-sm">
          <span>Weak foot</span>
          <Stars value={ratingStars(p.weakFoot)} />
        </li>
        <li className="flex items-center justify-between text-sm">
          <span>Work rate</span>
          <Stars value={ratingStars(p.attrs.workRate)} />
        </li>
      </ul>
    </div>
  );
}

export function PlayerHero({ g, p }: { g: GameState; p: Player }) {
  const kit = clubKit(p.clubId, g.season);
  return (
    <Card className="bg-sun-2" flat={false}>
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="sm:hidden"><PlayerPortrait appearance={p.look} age={age(g, p)} size={72} kit={kit} collar={kit.collar} /></span>
        <span className="hidden sm:block"><PlayerPortrait appearance={p.look} age={age(g, p)} size={104} kit={kit} collar={kit.collar} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <h1 className="font-display text-2xl leading-tight sm:text-4xl">{name(p)}</h1>
            <Flag code={p.nationality} className="text-lg" />
            {p.clubId && p.squadNo !== undefined && <ShirtNo no={p.squadNo} size="sm" />}
            {intlTeam(p) !== p.nationality && <span title={`Represents ${intlTeam(p)}`}><Flag code={intlTeam(p)} className="text-lg" /></span>}
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
        <div className="flex w-full gap-1 sm:w-auto sm:gap-2">
          <Badge tone="paper" className="whitespace-nowrap px-1.5 text-[10.5px] sm:px-2 sm:text-xs">Value {formatMoney(p.value)}</Badge>
          {p.contract && <Badge tone="paper" className="whitespace-nowrap px-1.5 text-[10.5px] sm:px-2 sm:text-xs">{formatMoney(p.contract.wage)}/wk · <span className="hidden sm:inline">until&nbsp;</span>{p.contract.expires + 1}</Badge>}
          <Badge tone="paper" className="whitespace-nowrap px-1.5 text-[10.5px] sm:px-2 sm:text-xs">
            Potential <Stars value={scoutStars(g, p)} className="text-[10px] sm:text-base" />
          </Badge>
        </div>
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

export function FixtureRow({ comp, f, teamId, next }: { comp: Competition; f: Fixture; teamId: string; next?: boolean }) {
  const g = useGame((s) => s.game);
  const home = f.home === teamId;
  const opp = home ? f.away : f.home;
  const res = resultFor(f, teamId);
  return (
    <li className={`grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-2 py-2 text-sm sm:col-span-4 sm:grid-cols-subgrid ${next ? "rounded-xl bg-sun-2 ring-2 ring-sun" : ""}`}>
      <span className="num row-span-2 text-xs leading-tight text-muted sm:row-span-1">{g ? formatTurnDate(g.season, f.turn).replace(/ \d{4}$/, "") : `W${f.turn}`}</span>
      <span className="flex min-w-0 items-center gap-2">
        <Crest clubId={opp} size={24} />
        <span className="truncate font-semibold">{teamLabel(opp)}</span>
        <span className="text-xs font-bold text-muted">{f.neutral ? "N" : home ? "H" : "A"}</span>
      </span>
      <CompChip comp={comp} stage={f.stage} className="col-start-2 row-start-2 pl-8 sm:col-start-3 sm:row-start-1 sm:pl-0" />
      <span className="col-start-3 row-span-2 row-start-1 flex items-center justify-end gap-1.5 sm:col-start-4 sm:row-span-1 sm:min-w-[4.5rem] sm:pl-2">
        {f.result ? (
          <>
            <span className={`grid size-5 place-items-center rounded-full border-2 border-line text-[10px] font-black ${res === "W" ? "bg-pitch text-white" : res === "L" ? "bg-coral" : "bg-sun"}`}>{res}</span>
            <span className="num min-w-[2.25rem] text-right tabular-nums">{scoreText(f)}</span>
          </>
        ) : next ? (
          <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-paper">Next</span>
        ) : null}
      </span>
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

function SimResultCard({ g, fixtureId }: { g: GameState; fixtureId: string }) {
  const f = Object.values(g.competitions).flatMap((c) => c.fixtures).find((x) => x.id === fixtureId);
  if (!f?.result) return null;
  const comp = g.competitions[f.compId];
  const goals = f.result.goals ?? [];
  return (
    <Card tone="coral" className="anim-slide" data-testid="sim-result">
      <div className="text-[11px] font-black uppercase tracking-widest">Full time · {comp?.name}{f.stage ? ` · ${f.stage}` : ""}</div>
      <div className="my-3 flex items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <Crest clubId={f.home} size={54} />
          <span className="text-sm font-bold">{teamLabel(f.home, true)}</span>
        </div>
        <span className="scoreboard rounded-xl border-2 border-sun bg-black px-4 py-1 text-3xl text-sun">{scoreText(f)}</span>
        <div className="flex flex-col items-center gap-1 text-center">
          <Crest clubId={f.away} size={54} />
          <span className="text-sm font-bold">{teamLabel(f.away, true)}</span>
        </div>
      </div>
      {goals.length > 0 && (
        <ul className="mb-3 grid gap-0.5 text-xs">
          {goals.map((gl, i) => (
            <li key={i} className={gl.side === "home" ? "text-left" : "text-right"}>
              ⚽ {g.players[gl.scorer] ? name(g.players[gl.scorer]) : "—"} {gl.minute}&apos;{gl.penalty ? " (pen)" : ""}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-center">
        <Link href="/play/match" className="pb-btn bg-sun px-5 text-[#1b1712]">Full match report</Link>
      </div>
    </Card>
  );
}

export function PendingMatchCard({ g }: { g: GameState }) {
  const sim = useGame((s) => s.simMatch);
  const busy = useGame((s) => s.busy);
  const [simmed, setSimmed] = useState<{ id: string; turnIndex: number } | null>(null);
  // The result belongs to the week it was played in; Continue moves on and clears it.
  const result = simmed && simmed.turnIndex === g.turnIndex ? <SimResultCard g={g} fixtureId={simmed.id} /> : null;
  const pm = g.pending[0];
  const comp = pm ? g.competitions[pm.compId] : undefined;
  const f = comp?.fixtures.find((x) => x.id === pm?.fixtureId);
  if (!pm || !comp || !f) return result;
  return (
    <>
      {result}
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
          <Button tone="paper" onClick={async () => { await sim(f.id); setSimmed({ id: f.id, turnIndex: g.turnIndex }); }} disabled={!!busy} data-testid="quick-sim">
            Quick sim
          </Button>
        </div>
      </Card>
    </>
  );
}

export function DecisionCards({ g }: { g: GameState }) {
  const decide = useGame((s) => s.decide);
  if (!g.user.decisions.length) return null;
  return (
    <>
      {g.user.decisions.map((d) => (
        <Card key={d.id} tone="plum" title={d.title}>
          <p className="mb-3 whitespace-pre-line text-sm">{d.body}</p>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
            {d.options.map((o) => (
              <button key={o.id} onClick={() => decide(d.id, o.id)} className="pb-btn pb-choice bg-card text-sm">
                <span>{o.label}</span>
                {o.hint && <span className="pb-choice-hint text-muted">{o.hint}</span>}
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

/** Prompt on the dashboard while the season's awards are waiting to be presented. */
export function AwardsNightCard({ g }: { g: GameState }) {
  const c = g.ceremony;
  if (!c || c.status === "completed") return null;
  return (
    <Card tone="sun" title="Awards Night">
      <p className="mb-3 text-sm">The {c.leagueName} awards for {seasonLabel(c.season)} are ready. {c.status === "in-progress" ? "You left the ceremony part-way through." : "Watch them presented, or skip to the results."}</p>
      <LinkButton href="/play/ceremony" tone="pitch">{c.status === "in-progress" ? "Resume ceremony" : "Open Awards Night"}</LinkButton>
    </Card>
  );
}
