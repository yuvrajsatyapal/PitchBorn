"use client";
import { useMemo, useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Badge, Bar, Card, Disclosure, FormDots, Stat } from "@/components/ui";
import { describeMemory } from "@/engine/memory/describe";
import { memoriesByImportance } from "@/engine/memory/store";
import { ROLE_LABEL } from "@/engine/career/offers";
import { currentObjectives, progressOf } from "@/engine/club/objectives";
import { clubHistory, clubIdentity, competitionRuns, departments, finances, recentMoves, relationshipInsights, userTacticalFit } from "@/engine/club/overview";
import { roleView } from "@/engine/club/role";
import { standingOf } from "@/engine/club/standing";
import { formatMoney } from "@/engine/players/economy";
import type { GameState } from "@/engine/types";
import { teamLabel } from "@/game/selectors";

const ord = (n: number) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

const ZONE_TONE = { title: "sun", continental: "sky", promotion: "pitch", safe: "paper", relegation: "coral", preseason: "paper" } as const;

/** League position, points, goal difference and what the position means, from the live table. */
export function SeasonContext({ g, clubId }: { g: GameState; clubId: string }) {
  const st = standingOf(g, clubId);
  if (!st) return null;
  const runs = competitionRuns(g, clubId);
  return (
    <div className="mt-4 rounded-xl border-2 border-line/30 p-3" data-testid="season-context">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-muted">{st.leagueName}</span>
        <Badge tone={ZONE_TONE[st.zone]} className="font-black">
          {st.preseason ? "Preseason" : st.position ? `${ord(st.position)} of ${st.size}` : "–"}
        </Badge>
        {!st.preseason && (
          <span className="text-sm">
            <b className="tabular-nums">{st.points}</b> pts · GD <b className="tabular-nums">{st.goalDifference > 0 ? `+${st.goalDifference}` : st.goalDifference}</b> · {st.played} played
          </span>
        )}
        {st.form.length > 0 && <FormDots form={st.form} />}
      </div>
      <p className="mt-1 text-sm text-ink-2">{st.situation}</p>
      {runs.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {runs.map((r) => (
            <li key={r.name} className="rounded-md border-2 border-line/20 px-1.5 py-0.5">
              <b>{r.name}:</b> {r.journey.status === "champion" ? "Winners 🏆" : r.journey.status === "eliminated" ? `out in the ${r.journey.stage}` : r.journey.status === "group-exit" ? "out in the groups" : r.journey.next ? `next: ${r.journey.next.stage}` : r.journey.stage ? `through the ${r.journey.stage}` : "still in"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function IdentityCard({ g, clubId }: { g: GameState; clubId: string }) {
  const club = g.clubs[clubId];
  const id = clubIdentity(g, club);
  const fit = userTacticalFit(g, club);
  const dots = [
    { label: "Pressing", v: id.values.pressing, text: id.pressing },
    { label: "Tempo", v: id.values.tempo, text: id.tempo },
    { label: "Directness", v: id.values.directness, text: id.directness },
  ];
  return (
    <Card title="Club identity" className="h-full" data-testid="club-identity">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <Badge tone="sun" className="font-black">{id.formation}</Badge>
        <Badge>{id.lean}</Badge>
        <Badge tone="plum">{id.approach}</Badge>
      </div>
      <div className="mt-3 grid gap-2">
        {dots.map((d) => (
          <div key={d.label}>
            <div className="mb-0.5 flex justify-between text-xs"><span className="font-semibold">{d.label}</span><span className="text-muted">{d.text}</span></div>
            <Bar value={d.v * 100} tone="sky" showValue={false} height={8} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-2">
        {club.manager.name}&apos;s style{id.tenure ? `, ${id.tenure} year${id.tenure === 1 ? "" : "s"} in charge` : ", newly appointed"}. {id.effects.join(" ")}
      </p>
      <div className="mt-2 rounded-lg border-2 border-line/20 bg-paper-2/60 px-2 py-1.5 text-xs">
        <b>Your fit:</b> {fit.label} ({fit.score}/100). {fit.note}
      </div>
    </Card>
  );
}

export function StrengthCard({ g, clubId }: { g: GameState; clubId: string }) {
  const ds = departments(g, clubId);
  return (
    <Card title="Squad strength" className="h-full" data-testid="squad-strength">
      <div className="grid gap-2.5">
        {ds.map((d) => (
          <div key={d.key}>
            <div className="mb-0.5 flex justify-between text-xs">
              <span className="font-semibold">{d.label}</span>
              <span className="text-muted">{ord(d.rank)} of {d.of} in the league</span>
            </div>
            <Bar value={d.value} tone={d.rank <= Math.ceil(d.of / 4) ? "pitch" : d.rank > d.of * 0.75 ? "coral" : "sun"} height={10} />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">The average rating of the starters the squad would field in each area, ranked against the other clubs in your league.</p>
    </Card>
  );
}

export function RoleCard({ g }: { g: GameState }) {
  const r = roleView(g);
  if (!r) return null;
  return (
    <Card title="Your squad role" className="h-full" data-testid="squad-role">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="sun" className="text-sm font-black">{r.label}</Badge>
        {r.suggested !== r.role && <span className="text-xs text-muted">Your standing in the squad suggests: {ROLE_LABEL[r.suggested]}</span>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Expected to start" value={`${Math.round(r.expectedShare * 100)}%`} sub="of the club's games" />
        <Stat label="Starting so far" value={r.actualShare === null ? "–" : `${Math.round(r.actualShare * 100)}%`} sub={r.actualShare === null ? `after ${r.matches} games (needs 6)` : `${r.matches} games`} tone={r.meeting === null ? undefined : r.meeting ? "pitch" : "coral"} />
      </div>
      <p className="mt-2 text-sm">
        {r.meeting === null ? "Too early to judge your playing time." : r.meeting ? "You're getting the playing time your role calls for." : "You're playing less than the role you signed for promises: this strains your relationship with the manager."}
      </p>
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        <span className="text-muted">Recent selection:</span>
        {r.trend.length ? r.trend.map((d, i) => (
          <span key={i} title={`${teamLabel(d.opponent, true)}: ${d.status === "started" ? "started" : d.status === "sub" ? "came on" : "did not play"}`} className={`grid h-6 w-6 place-items-center rounded-md border-2 border-line text-[10px] font-black ${d.status === "started" ? "bg-pitch text-white" : d.status === "sub" ? "bg-sun" : "bg-paper-2 text-muted"}`}>
            {d.status === "started" ? "S" : d.status === "sub" ? "B" : "–"}
          </span>
        )) : <span className="text-muted">no games yet</span>}
      </div>
      <p className="mt-2 text-xs text-ink-2">Pathway: {r.pathway}</p>
    </Card>
  );
}

export function AmbitionsCard({ g, clubId }: { g: GameState; clubId: string }) {
  const obj = currentObjectives(g);
  if (!obj) return null;
  return (
    <Card title="Season ambitions" className="h-full" data-testid="season-ambitions">
      <ul className="grid gap-2">
        {obj.items.map((o) => {
          const p = progressOf(g, clubId, o);
          const tone = p.state === "met" || p.state === "on-course" ? "pitch" : p.state === "missed" || p.state === "off-course" ? "coral" : "paper";
          return (
            <li key={o.id} className="rounded-lg border-2 border-line/20 px-2.5 py-1.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b>{p.label}</b>
                <Badge tone={tone}>{p.state === "met" ? "Met" : p.state === "missed" ? "Missed" : p.state === "on-course" ? "On course" : p.state === "off-course" ? "Off course" : "Open"}</Badge>
              </div>
              <div className="text-xs text-ink-2">{p.detail}</div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted">The board sets these from where the club stands. Meeting them lifts the board&apos;s confidence in you; missing them lowers it.</p>
    </Card>
  );
}

const REL_TONE = { manager: "sky", teammates: "pitch", supporters: "sun", board: "plum" } as const;
const REL_LABEL = { manager: "Manager", teammates: "Teammates", supporters: "Supporters", board: "Board" } as const;

export function RelationshipsCard({ g }: { g: GameState }) {
  const insights = useMemo(() => relationshipInsights(g), [g, g.turnIndex, g.user.relationships.manager, g.user.relationships.board, g.user.relationships.supporters, g.user.relationships.teammates, g.user.relLog?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card title="Relationships" data-testid="relationships">
      <div className="grid gap-3">
        {insights.map((r) => (
          <div key={r.key}>
            <Bar label={REL_LABEL[r.key]} value={r.value} tone={REL_TONE[r.key]} />
            <button type="button" className="mt-0.5 text-left text-xs font-semibold underline decoration-dotted" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>
              {r.headline} {open === r.key ? "▾" : "▸"}
            </button>
            {open === r.key && (
              <div className="mt-1 grid gap-1 rounded-lg border-2 border-line/20 bg-paper-2/60 p-2 text-xs">
                {r.consequences.map((c) => <div key={c}>• {c}</div>)}
                {r.reasons.length > 0 ? (
                  <div className="mt-1 border-t border-line/15 pt-1">
                    <div className="font-bold">Lately</div>
                    {r.reasons.map((x, i) => <div key={i} className={x.delta >= 0 ? "text-pitch" : "text-coral"}>{x.delta >= 0 ? "▲" : "▼"} {x.cause} ({x.delta > 0 ? "+" : ""}{x.delta.toFixed(1)})</div>)}
                  </div>
                ) : (
                  <div className="text-muted">Nothing has moved this lately.</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function MovesAndFinances({ g, clubId }: { g: GameState; clubId: string }) {
  const fin = finances(g, clubId);
  const mv = recentMoves(g, clubId);
  if (!fin) return null;
  const row = (m: (typeof mv.arrivals)[number]) => (
    <li key={`${m.playerId}-${m.season}-${m.turn}`} className="flex items-center justify-between gap-2 text-sm">
      <span className="min-w-0 truncate">{m.name} <span className="text-xs text-muted">{m.position}</span></span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">{m.other ? <><Crest clubId={m.other} size={14} /> {teamLabel(m.other, true)}</> : "Free agent"} · {m.fee ? formatMoney(m.fee) : "free"}</span>
    </li>
  );
  return (
    <Disclosure title="Transfers & finances" summary={`${fin.verdict} · ${fin.direction}`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Condition" value={<span className="text-lg">{fin.verdict}</span>} tone={fin.verdict === "In trouble" ? "coral" : fin.verdict === "Tight" ? "sun" : "pitch"} />
        <Stat label="Balance" value={formatMoney(fin.balance)} />
        <Stat label="Wage bill" value={formatMoney(fin.wageBill)} sub={`per week · ${Math.round(fin.wageRatio * 100)}% of revenue`} />
        <Stat label="Net spend" value={formatMoney(-fin.netSpend)} sub="recent window(s)" />
      </div>
      <p className="mt-2 text-xs text-ink-2">Direction: {fin.direction}. Average squad age {fin.averageAge.toFixed(1)}.</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-black uppercase text-muted">Recent arrivals</div>
          <ul className="grid gap-1">{mv.arrivals.length ? mv.arrivals.map(row) : <li className="text-sm text-muted">None recorded.</li>}</ul>
        </div>
        <div>
          <div className="mb-1 text-xs font-black uppercase text-muted">Recent departures</div>
          <ul className="grid gap-1">{mv.departures.length ? mv.departures.map(row) : <li className="text-sm text-muted">None recorded.</li>}</ul>
        </div>
      </div>
    </Disclosure>
  );
}

export function HistoryCard({ g, clubId }: { g: GameState; clubId: string }) {
  const h = useMemo(() => clubHistory(g, clubId), [g, clubId, g.season]); // eslint-disable-line react-hooks/exhaustive-deps
  const memories = useMemo(
    () => memoriesByImportance(g).filter((m) => m.clubId === clubId).slice(0, 3).map((m) => ({ id: m.id, ...describeMemory(g, m) })),
    [g, clubId, g.user.memories.length], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <Disclosure title="History & rivalries" summary={`${h.real.titles} real top-flight title${h.real.titles === 1 ? "" : "s"} in the data · ${h.simulated.leagueTitles + h.simulated.cups + h.simulated.continental} won in this career`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase text-muted">Real league history <Badge>from real tables</Badge></div>
          {h.real.seasons ? (
            <ul className="grid gap-1 text-sm">
              <li>Seasons on record: <b>{h.real.seasons}</b> ({h.real.span})</li>
              <li>Top-flight titles: <b>{h.real.titles}</b></li>
              <li>Best finish: <b>{h.real.bestPos ?? "–"}</b>{h.real.lastPos ? ` · last recorded: ${ord(h.real.lastPos)} (${h.real.lastSeason})` : ""}</li>
            </ul>
          ) : <p className="text-sm text-muted">No real league tables in the dataset for this club.</p>}
          <p className="mt-1 text-[11px] text-muted">Only the seasons in the game&apos;s open dataset are counted: older honours aren&apos;t invented.</p>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase text-muted">In your career <Badge tone="sun">simulated</Badge></div>
          {h.simulated.seasons ? (
            <ul className="grid gap-1 text-sm">
              <li>League titles: <b>{h.simulated.leagueTitles}</b> · Domestic cups: <b>{h.simulated.cups}</b> · Continental: <b>{h.simulated.continental}</b></li>
              <li>Best finish: <b>{h.simulated.bestPos ?? "–"}</b> · Promotions {h.simulated.promotions} · Relegations {h.simulated.relegations}</li>
              {h.records.map((r) => <li key={r.label}>{r.label}: <b>{r.value}</b></li>)}
            </ul>
          ) : <p className="text-sm text-muted">The first completed season will appear here.</p>}
        </div>
        <div>
          <div className="mb-1 text-xs font-black uppercase text-muted">Rivals</div>
          {h.rivals.length ? (
            <ul className="grid gap-1 text-sm">
              {h.rivals.map((r) => <li key={r.clubId} className="flex items-center gap-2"><Crest clubId={r.clubId} size={18} /> <b>{teamLabel(r.clubId)}</b> <Badge tone={r.level >= 0.6 ? "coral" : "paper"}>{r.label}</Badge></li>)}
            </ul>
          ) : <p className="text-sm text-muted">No standout rivals.</p>}
        </div>
        <div>
          <div className="mb-1 text-xs font-black uppercase text-muted">Your contribution</div>
          <p className="text-sm">{h.user.apps} appearances · {h.user.goals} goals · {h.user.assists} assists over {h.user.seasons} season{h.user.seasons === 1 ? "" : "s"}. {h.user.trophies} trophies · {h.user.memories} Football Memories here.</p>
          {memories.length > 0 && (
            <ul className="mt-2 grid gap-1 text-xs">
              {memories.map((m) => (
                <li key={m.id} className="rounded-lg border-2 border-line/15 px-2 py-1"><b>{m.icon} {m.title}</b> <span className="text-muted">· {m.seasonLabel}</span><div className="text-ink-2">{m.line}</div></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Disclosure>
  );
}
