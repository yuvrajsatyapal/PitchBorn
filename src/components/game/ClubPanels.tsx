"use client";
import { useMemo, useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Badge, Bar, Card, Disclosure, FormDots, Stat } from "@/components/ui";
import { describeMemory } from "@/engine/memory/describe";
import { ROLE_LABEL } from "@/engine/career/offers";
import { currentObjectives, progressOf } from "@/engine/club/objectives";
import { clubHistory, clubIdentity, clubMoments, ord, competitionRuns, departments, finances, recentMoves, relationshipInsights, userTacticalFit } from "@/engine/club/overview";
import { roleView } from "@/engine/club/role";
import { standingOf, type Zone } from "@/engine/club/standing";
import { staticClub, stadium } from "@/engine/data/world";
import { seasonLabel } from "@/engine/calendar";
import { formatMoney } from "@/engine/players/economy";
import type { GameState, Player, StatLine } from "@/engine/types";
import { fmtRating, name, seasonTotal, teamLabel } from "@/game/selectors";
import { avgRating } from "@/engine/players/generate";
import { squadOf } from "@/engine/world/helpers";

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
          <span key={i} title={`${teamLabel(d.opponent, true)}: ${d.status === "started" ? "started" : d.status === "sub" ? "came on" : "did not play"}`} className={`grid h-6 w-6 place-items-center rounded-md border-2 border-line text-[11px] font-black ${d.status === "started" ? "bg-pitch text-white" : d.status === "sub" ? "bg-sun" : "bg-paper-2 text-muted"}`}>
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
            <button type="button" className="pb-hit mt-0.5 text-left text-xs font-semibold underline decoration-dotted" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>
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

function HistoryRow({ label, children, detail }: { label: string; children: React.ReactNode; detail?: string }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <span className="text-ink-2">{label}</span>
      <span className="min-w-0 text-right">
        <b>{children}</b>
        {detail && <span className="block break-words text-[11px] text-muted">{detail}</span>}
      </span>
    </li>
  );
}

const HEAD = "mb-1.5 flex flex-wrap items-center gap-2 text-xs font-black uppercase text-muted";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const MAX_HONOURS_LISTED = 6;

export function HistoryCard({ g, clubId }: { g: GameState; clubId: string }) {
  const h = useMemo(() => clubHistory(g, clubId), [g, clubId]);
  const moments = useMemo(() => clubMoments(g, clubId).map((m) => ({ id: m.id, ...describeMemory(g, m) })), [g, clubId]);
  const { real, simulated: sim, user: you } = h;
  const played = you.apps > 0;
  return (
    <Disclosure title="History & Honours" summary={`${plural(real.majors.league, "league title")}${real.majors.champions ? ` · ${plural(real.majors.champions, "Champions League", "Champions Leagues")}` : ""} · ${h.honours.length} won in this career`}>
      <div className="grid gap-5 md:grid-cols-2">
        <section>
          <div className={HEAD}>Real club history <Badge>real</Badge></div>
          <ul className="grid gap-1 text-sm">
            {real.founded !== null && <HistoryRow label="Founded">{real.founded}</HistoryRow>}
            <HistoryRow label="League titles" detail="all time">{real.majors.league}</HistoryRow>
            <HistoryRow label="Champions League" detail="European Cup included">{real.majors.champions}</HistoryRow>
            <HistoryRow label="Europa League" detail="UEFA Cup included">{real.majors.europa}</HistoryRow>
          </ul>
          <p className="mt-1.5 text-[11px] text-muted">Major honours are real all-time totals to the end of 2024-25.</p>
        </section>

        <section>
          <div className={HEAD}>In your career <Badge tone="sun">simulated</Badge></div>
          {sim.seasons > 0 ? (
            <ul className="grid gap-1 text-sm">
              <HistoryRow label="Seasons simulated">{sim.seasons}</HistoryRow>
              {sim.latest && <HistoryRow label="Latest finish" detail={[seasonLabel(sim.latest.season), sim.latest.league].filter(Boolean).join(" · ")}>{ord(sim.latest.pos)}</HistoryRow>}
              <HistoryRow label="Relegations">{sim.relegations}</HistoryRow>
            </ul>
          ) : <p className="text-sm text-muted">The first completed season will appear here.</p>}
        </section>

        {sim.seasons > 0 && (
          <>
            <section data-testid="club-honours">
              <div className={HEAD}>Honours <Badge tone="sun">simulated</Badge></div>
              <ul className="grid gap-1 text-sm">
                <HistoryRow label="League titles">{sim.leagueTitles}</HistoryRow>
                <HistoryRow label="Domestic cups">{sim.cups}</HistoryRow>
                <HistoryRow label="Continental">{sim.continental}</HistoryRow>
                <HistoryRow label="Promotions">{sim.promotions}</HistoryRow>
              </ul>
              {h.honours.length > 0 && (
                <ul className="mt-2 grid gap-1 border-t-2 border-line/15 pt-2 text-sm">
                  {h.honours.slice(0, MAX_HONOURS_LISTED).map((t) => (
                    <li key={`${t.season}-${t.name}`} className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="min-w-0 break-words">🏆 {t.name}</span>
                      <span className="text-xs text-muted">{seasonLabel(t.season)}</span>
                    </li>
                  ))}
                  {h.honours.length > MAX_HONOURS_LISTED && <li className="text-xs text-muted">and {h.honours.length - MAX_HONOURS_LISTED} earlier</li>}
                </ul>
              )}
            </section>
            <section data-testid="club-records">
              <div className={HEAD}>Club records <Badge tone="sun">simulated</Badge></div>
              <ul className="grid gap-1 text-sm">
                {h.records.map((r) => <HistoryRow key={r.id} label={r.label} detail={r.detail}>{r.value}</HistoryRow>)}
              </ul>
            </section>
          </>
        )}

        <section className="md:col-span-2" data-testid="club-legacy">
          <div className={HEAD}>Your legacy <Badge tone="sun">simulated</Badge></div>
          <div className="text-sm">
            <div className="font-bold">{plural(you.seasonsAtClub, "season")} at club</div>
            {played ? (
              <>
                <p>{plural(you.apps, "appearance")}{you.starts !== null ? ` · ${plural(you.starts, "start")}` : ""}</p>
                <p>{plural(you.goals, "goal")}{you.assists !== null ? ` · ${plural(you.assists, "assist")}` : ""}</p>
              </>
            ) : (
              <p className="text-muted">No senior appearances yet.</p>
            )}
            <p>{plural(you.trophies, "trophy", "trophies")} · {plural(you.memories, "Football Memory", "Football Memories")}</p>
          </div>
          {you.best.length > 0 && (
            <ul className="mt-2 grid gap-x-6 gap-y-1 border-t-2 border-line/15 pt-2 text-sm sm:grid-cols-2">
              {you.best.map((r) => <HistoryRow key={r.id} label={r.label} detail={r.detail}>{r.value}</HistoryRow>)}
            </ul>
          )}
        </section>

        {moments.length > 0 && (
          <section className="md:col-span-2" data-testid="club-moments">
            <div className={HEAD}>Iconic moments</div>
            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
              {moments.map((m) => (
                <li key={m.id} className="min-w-0 rounded-lg border-2 border-line/15 px-2.5 py-1.5">
                  <b className="break-words">{m.icon} {m.title}</b> <span className="text-xs text-muted">· {m.seasonLabel}</span>
                  <div className="break-words text-xs text-ink-2">{m.line}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Disclosure>
  );
}

const MIN_APPS_FOR_RATING = 10;
const PLACEHOLDER_LEADERS = ["Top scorer", "Most assists", "Best rated", "Most appearances"];

/** A player's club-only totals here: this season plus every earlier season recorded at the club (international games excluded). */
function clubTotal(p: Player, clubId: string): StatLine {
  const total = seasonTotal(p);
  for (const h of p.history) {
    if (h.clubId !== clubId) continue;
    total.apps += h.stats.apps - (h.intl?.caps ?? 0);
    total.goals += h.stats.goals - (h.intl?.goals ?? 0);
    total.assists += h.stats.assists;
    total.ratingSum += h.stats.ratingSum;
  }
  return total;
}

export function ClubLeadersCard({ g, clubId }: { g: GameState; clubId: string }) {
  const rows = squadOf(g, clubId).map((p) => ({ p, s: clubTotal(p, clubId) })).filter((r) => r.s.apps > 0);
  if (rows.length === 0) {
    return (
      <Card title="Club leaders" data-testid="club-leaders">
        <ul className="grid gap-3">
          {PLACEHOLDER_LEADERS.map((label) => (
            <li key={label} className="flex items-center justify-between gap-3 rounded-lg border-2 border-line/20 px-2.5 py-1.5 text-sm">
              <span className="min-w-0">
                <span className="block text-[11px] font-black uppercase tracking-wider text-muted">{label}</span>
                <b className="block truncate text-muted">Not decided yet</b>
              </span>
              <span className="shrink-0 font-black tabular-nums text-muted">-</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted">All time at the club, current squad.</p>
      </Card>
    );
  }
  const top = (pick: (s: (typeof rows)[number]["s"]) => number, eligible: (s: (typeof rows)[number]["s"]) => boolean = () => true) =>
    rows.filter((r) => eligible(r.s)).reduce<(typeof rows)[number] | null>((best, r) => (!best || pick(r.s) > pick(best.s) ? r : best), null);
  const leaders = [
    { label: "Top scorer", row: top((s) => s.goals), value: (s: (typeof rows)[number]["s"]) => `${s.goals} goals` },
    { label: "Most assists", row: top((s) => s.assists), value: (s: (typeof rows)[number]["s"]) => `${s.assists} assists` },
    { label: "Best rated", row: top((s) => avgRating(s), (s) => s.apps >= MIN_APPS_FOR_RATING), value: (s: (typeof rows)[number]["s"]) => fmtRating(s) },
    { label: "Most appearances", row: top((s) => s.apps), value: (s: (typeof rows)[number]["s"]) => `${s.apps} apps` },
  ].filter((l) => l.row && (l.label === "Best rated" || l.label === "Most appearances" || l.value(l.row.s).split(" ")[0] !== "0"));
  return (
    <Card title="Club leaders" data-testid="club-leaders">
      <ul className="grid gap-3">
        {leaders.map(({ label, row, value }) => row && (
          <li key={label} className="flex items-center justify-between gap-3 rounded-lg border-2 border-line/20 px-2.5 py-1.5 text-sm">
            <span className="min-w-0">
              <span className="block text-[11px] font-black uppercase tracking-wider text-muted">{label}</span>
              <b className="block truncate">{name(row.p)}</b>
            </span>
            <span className="shrink-0 font-black tabular-nums">{value(row.s)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted">All time at the club, current squad.</p>
    </Card>
  );
}

const MOOD_BASE = 50;
const MOOD_FORM_POINTS = { W: 7, D: -1, L: -7 } as const;
const MOOD_ZONE_POINTS: Record<Zone, number> = { title: 22, continental: 12, promotion: 12, safe: 0, relegation: -22, preseason: 0 };

function moodWord(v: number): { word: string; tone: "pitch" | "sun" | "coral" } {
  if (v >= 75) return { word: "Buzzing", tone: "pitch" };
  if (v >= 58) return { word: "Upbeat", tone: "pitch" };
  if (v >= 42) return { word: "Restless", tone: "sun" };
  return { word: "Angry", tone: "coral" };
}

/** Terrace mood from recent results and where the club sits in the table; derived, never stored. */
export function StadiumMoodCard({ g, clubId }: { g: GameState; clubId: string }) {
  const stad = stadium(staticClub(clubId)?.stadiumId ?? "");
  const st = standingOf(g, clubId);
  if (!stad || !st) return null;
  const mood = Math.max(0, Math.min(100, MOOD_BASE + st.form.reduce((a, r) => a + MOOD_FORM_POINTS[r], 0) + MOOD_ZONE_POINTS[st.zone]));
  const { word, tone } = moodWord(mood);
  return (
    <Card title="Stadium & fan mood" data-testid="stadium-mood">
      <div className="flex items-baseline justify-between gap-3">
        <b>{stad.name}</b>
        <span className="text-sm text-muted">{stad.capacity.toLocaleString()} seats</span>
      </div>
      <div className="mt-3">
        <Bar label={`Fan mood · ${word}`} value={mood} tone={tone} />
      </div>
      <p className="mt-2 text-xs text-ink-2">Shaped by recent results and league position.</p>
    </Card>
  );
}
