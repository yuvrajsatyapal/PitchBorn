"use client";
import { useMemo, useState } from "react";
import { Columns, type ColumnItem } from "@/components/game/Columns";
import { RatingChart } from "@/components/game/RatingChart";
import { toChart } from "@/components/game/RecentRatings";
import { Badge, Card, Stat, Table, Tabs } from "@/components/ui";
import { formatTurnDate, seasonLabel } from "@/engine/calendar";
import { PAY_LABEL } from "@/engine/career/money";
import { positionGroup } from "@/engine/players/attributes";
import { formatMoney } from "@/engine/players/economy";
import { avgRating, emptyStat } from "@/engine/players/generate";
import {
  BEST_MIN_MINUTES,
  PER90_MIN_MINUTES,
  byCompetitionKind,
  byPositionPlayed,
  byRole,
  comparables,
  compareWith,
  formTrend,
  homeAway,
  leagueRankings,
  logForSeason,
  mean,
  milestones,
  per90Rows,
  personalBests,
  ratedMatches,
  reserveForm,
  seasonLines,
  startSplit,
  type SplitRow,
} from "@/engine/stats/analytics";
import { isPartial } from "@/engine/stats/matchlog";
import type { GameState, PayKind, StatLine } from "@/engine/types";
import { user } from "@/game/selectors";

const sl = (n: number) => String(seasonLabel(n));

// ---------------------------------------------------------------------------------------------- form and ratings

export function FormPanel({ g, version }: { g: GameState; version: number }) {
  const [n, setN] = useState<"5" | "10" | "season">("10");
  const [series, setSeries] = useState<"senior" | "dev">("senior");
  const data = useMemo(() => {
    const all = ratedMatches(g);
    const seasonOnly = all.filter((e) => e.season === g.season);
    const picked = n === "season" ? seasonOnly : all.slice(-Number(n));
    return { picked, all, trend: formTrend(all.map((e) => e.rating)), dev: reserveForm(g, 30) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, n, g.turnIndex]);
  const avg = mean(data.picked.map((e) => e.rating));
  const best = data.picked.reduce<number>((m, e) => Math.max(m, e.rating), 0);
  const worst = data.picked.length ? data.picked.reduce<number>((m, e) => Math.min(m, e.rating), 10) : 0;
  const devChart = data.dev.entries.slice(n === "5" ? -5 : n === "10" ? -10 : undefined).map((e, i) => ({ key: `d${i}`, season: e.season, turn: e.turn, rating: e.rating, opponent: "Development squad", goals: e.goals, assists: e.assists }));
  return (
    <Card
      title="Form & match ratings"
      action={
        <div className="flex flex-wrap gap-2">
          <Tabs value={n} onChange={setN} items={[{ id: "5", label: "Last 5" }, { id: "10", label: "Last 10" }, { id: "season", label: "Season" }]} />
          {data.dev.entries.length > 0 && <Tabs value={series} onChange={setSeries} items={[{ id: "senior", label: "Senior" }, { id: "dev", label: "Development" }]} />}
        </div>
      }
    >
      <RatingChart size="large" variant="line" matches={series === "senior" ? data.picked.map((e) => toChart(e, g)) : devChart} average={series === "senior" ? avg : data.dev.average} label="Match ratings" />
      {series === "senior" && data.picked.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Average" value={avg.toFixed(2)} tone="sun" sub={`${data.picked.length} rated game${data.picked.length === 1 ? "" : "s"}`} />
          <Stat label="Best" value={best.toFixed(1)} tone="pitch" />
          <Stat label="Worst" value={worst.toFixed(1)} tone="coral" />
          <Stat label="Trend" value={<span className="text-lg capitalize">{data.trend === "unknown" ? "–" : data.trend}</span>} sub={data.trend === "unknown" ? "Needs 6 rated games" : "last 3 vs the 3 before"} />
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted">
        Senior appearances only; development-squad games are charted separately and never averaged in. Average rating is the sum of match ratings divided by appearances, substitute cameos counting the same as full games.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------- per-90 and starts

export function Per90Panel({ g }: { g: GameState }) {
  const p = user(g);
  const lines = seasonLines(g);
  const [sel, setSel] = useState<string>("current");
  const options = [{ id: "current", label: "This season" }, ...[...lines].reverse().filter((l) => !l.current).slice(0, 4).map((l) => ({ id: String(l.season), label: sl(l.season) })), { id: "career", label: "Career" }];
  const stat: StatLine =
    sel === "career" ? p.career : sel === "current" ? (lines.find((l) => l.current)?.stats ?? seasonLines(g).find((l) => l.season === g.season)?.stats ?? emptyStat()) : (lines.find((l) => String(l.season) === sel)?.stats ?? emptyStat());
  const group = positionGroup(p.position);
  const rows = per90Rows(stat, group);
  const split = startSplit(stat);
  const enough = stat.minutes >= PER90_MIN_MINUTES;
  return (
    <Card title="Per 90 & starts" action={<Tabs value={sel} onChange={setSel} items={options} />}>
      {stat.apps === 0 ? (
        <p className="text-sm text-muted">No appearances in this period.</p>
      ) : (
        <>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Table>
              <thead>
                <tr><th>Per 90 minutes</th><th className="text-right">Rate</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td className="text-right font-bold tabular-nums">{r.value.toFixed(2)}</td>
                    <td className="text-right text-muted tabular-nums">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="grid grid-cols-2 grid-rows-2 gap-2">
            <Stat label="Starts" value={split.starts} sub={`${Math.round(split.startPct * 100)}% of apps`} tone="pitch" />
            <Stat label="From the bench" value={split.subs} sub="substitute appearances" />
            <Stat label="Avg minutes" value={Math.round(split.minPerApp)} sub="per appearance" />
            <Stat label="Avg rating" value={stat.apps ? avgRating(stat).toFixed(2) : "–"} tone="sun" sub={`${stat.apps} apps`} />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Rate = total ÷ minutes × 90 ({stat.minutes.toLocaleString()} minutes).{" "}
          {enough ? "" : `Under ${PER90_MIN_MINUTES} minutes is a small sample: treat these rates with care and don't compare them with a regular starter's.`}
        </p>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------- timeline

export function TimelinePanel({ g, version }: { g: GameState; version: number }) {
  const seasons = [...new Set((g.user.matchLog ?? []).map((e) => e.season))].sort((a, b) => b - a);
  const [season, setSeason] = useState<string>("current");
  const target = season === "current" ? g.season : Number(season);
  const items = useMemo<ColumnItem[]>(
    () =>
      logForSeason(g, target).map((e) => ({
        key: e.fixtureId,
        label: String(e.turn),
        segments: [
          { value: e.goals, className: "bg-pitch" },
          { value: e.assists, className: "bg-sky" },
        ],
        top: e.goals + e.assists > 0 ? String(e.goals + e.assists) : undefined,
        detail: `${formatTurnDate(e.season, e.turn).replace(/ \d{4}$/, "")} · ${e.goals} goal${e.goals === 1 ? "" : "s"}, ${e.assists} assist${e.assists === 1 ? "" : "s"} · vs ${e.opponent} · rated ${e.rating.toFixed(1)}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, target],
  );
  const goals = items.reduce((s, i) => s + i.segments[0].value, 0);
  const assists = items.reduce((s, i) => s + i.segments[1].value, 0);
  const gk = user(g).position === "GK";
  if (gk) return null;
  return (
    <Card
      title="Goals & assists timeline"
      action={
        seasons.length > 1 ? (
          <select value={season} onChange={(e) => setSeason(e.target.value)} className="rounded-full border-2 border-line bg-card px-3 py-1.5 text-sm font-bold" aria-label="Season">
            <option value="current">This season</option>
            {seasons.filter((s) => s !== g.season).map((s) => <option key={s} value={s}>{sl(s)}</option>)}
          </select>
        ) : undefined
      }
    >
      <Columns items={items} height={110} label="Goals and assists by match" empty="No matches recorded for this season yet." />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border-2 border-line bg-pitch" /> Goals {goals}</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border-2 border-line bg-sky" /> Assists {assists}</span>
        <span className="text-muted">One column per match, in order (week number below).</span>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------- records

export function RecordsPanel({ g }: { g: GameState }) {
  const bests = personalBests(g);
  const ms = milestones(g);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Personal bests">
        {bests.length ? (
          <ul className="grid gap-1.5 text-sm">
            {bests.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border-2 border-line/15 px-2.5 py-1.5">
                <span>
                  {b.label}
                  {b.note && <span className="block text-[11px] text-muted">{b.note}</span>}
                </span>
                <span className="text-right">
                  <b className="tabular-nums">{b.display}</b>
                  <span className="block text-[11px] text-muted">{sl(b.season)}{b.current ? " · in progress" : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Records appear once you have a season on the board. Rate records need {BEST_MIN_MINUTES} minutes.</p>
        )}
      </Card>
      <Card title="Milestones">
        <ul className="grid gap-1.5 text-sm">
          {ms.map((m) => (
            <li key={m.id} className={`flex items-center justify-between gap-2 rounded-lg border-2 px-2.5 py-1.5 ${m.reached ? "border-line/15" : "border-dashed border-line/30"}`}>
              <span className={m.reached ? "" : "text-ink-2"}>{m.reached ? "✅" : "⏳"} {m.label}</span>
              <span className="text-[11px] text-muted">{m.reached ? (m.when ? sl(m.when.season) : "reached") : m.progress ? `${m.progress.have} / ${m.progress.need}` : ""}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- rankings and comparison

export function RankingPanel({ g, version }: { g: GameState; version: number }) {
  const rows = useMemo(() => leagueRankings(g), [g, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [who, setWho] = useState<string>("");
  const cands = useMemo(() => comparables(g), [g, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const cmp = who ? compareWith(g, who) : null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="League rankings">
        {rows.length ? (
          <ul className="grid gap-1.5 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border-2 border-line/15 px-2.5 py-1.5">
                <span>
                  {r.label}
                  {r.reason && <span className="block text-[11px] text-muted">{r.reason}</span>}
                </span>
                <span className="text-right">
                  <b className="tabular-nums">{r.value}</b>
                  <span className="block text-[11px] text-muted">{r.rank ? `#${r.rank} of ${r.of}` : "unranked"}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Rankings appear when you play in a league.</p>
        )}
        <p className="mt-2 text-[11px] text-muted">Rate rankings only count players with enough league minutes, so a few cameos can&apos;t top the table.</p>
      </Card>
      <Card title="Compare with">
        {cands.length ? (
          <>
            <select value={who} onChange={(e) => setWho(e.target.value)} className="mb-3 w-full rounded-lg border-2 border-line bg-card px-2 py-2 text-sm" aria-label="Player to compare with">
              <option value="">Choose a player…</option>
              {cands.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.position} · {c.note}</option>
              ))}
            </select>
            {cmp?.reason && <p className="text-sm text-muted">{cmp.reason}</p>}
            {cmp && cmp.rows.length > 0 && (
              <Table>
                <thead>
                  <tr><th>This season (league)</th><th className="text-right">You</th><th className="text-right">Them</th></tr>
                </thead>
                <tbody>
                  {cmp.rows.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className={`text-right tabular-nums ${r.lead === "mine" ? "font-black text-pitch" : ""}`}>{r.mine}</td>
                      <td className={`text-right tabular-nums ${r.lead === "theirs" ? "font-black text-coral" : ""}`}>{r.theirs}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {!who && <p className="text-sm text-muted">Pick a rival, teammate or a top player in your position.</p>}
          </>
        ) : (
          <p className="text-sm text-muted">No comparable players yet: both players need enough league minutes this season.</p>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- splits

function SplitTable({ title, rows }: { title: string; rows: SplitRow[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-black uppercase text-muted">{title}</div>
      {rows.length ? (
        <Table>
          <thead>
            <tr><th /><th className="text-right">Apps</th><th className="text-right">Mins</th><th className="text-right">G</th><th className="text-right">A</th><th className="text-right">Avg</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className="text-right tabular-nums">{r.apps}</td>
                <td className="text-right tabular-nums">{r.minutes}</td>
                <td className="text-right font-bold tabular-nums">{r.goals}</td>
                <td className="text-right tabular-nums">{r.assists}</td>
                <td className="text-right tabular-nums">{r.avg.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="text-sm text-muted">No matches recorded yet.</p>
      )}
    </div>
  );
}

export function SplitsPanel({ g, version }: { g: GameState; version: number }) {
  const [scope, setScope] = useState<"season" | "all">("season");
  const { log, partial } = useMemo(() => {
    const l = logForSeason(g, scope === "season" ? g.season : "all");
    return { log: l, partial: l.filter(isPartial).length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, scope]);
  return (
    <Card title="Breakdowns" action={<Tabs value={scope} onChange={setScope} items={[{ id: "season", label: "This season" }, { id: "all", label: "Recorded matches" }]} />}>
      <div className="grid gap-4 md:grid-cols-2">
        <SplitTable title="Home vs away" rows={homeAway(log)} />
        <SplitTable title="Starts vs substitute appearances" rows={byRole(log)} />
        <SplitTable title="By position played" rows={byPositionPlayed(log)} />
        <SplitTable title="By competition" rows={byCompetitionKind(log)} />
      </div>
      {partial > 0 && <p className="mt-2 text-[11px] text-muted">{partial} older match{partial === 1 ? "" : "es"} from before this was recorded {partial === 1 ? "is" : "are"} left out: only the rating was kept.</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------- progression

type Metric = "apps" | "minutes" | "goals" | "assists" | "rating" | "cs" | "saves";

export function ProgressionPanel({ g }: { g: GameState }) {
  const p = user(g);
  const gk = p.position === "GK";
  const [metric, setMetric] = useState<Metric>(gk ? "cs" : "goals");
  const lines = seasonLines(g);
  const pick = (s: StatLine): number => ({ apps: s.apps, minutes: s.minutes, goals: s.goals, assists: s.assists, rating: avgRating(s), cs: s.cleanSheets, saves: s.saves })[metric];
  const fmt = (v: number) => (metric === "rating" ? v.toFixed(2) : String(Math.round(v)));
  const items: ColumnItem[] = lines.map((l) => ({
    key: String(l.season),
    label: sl(l.season).slice(2, 4) + "/" + sl(l.season).slice(5),
    segments: [{ value: metric === "rating" ? Math.max(0, pick(l.stats) - 4) : pick(l.stats), className: l.current ? "bg-sun" : "bg-pitch" }],
    top: pick(l.stats) ? fmt(pick(l.stats)) : undefined,
    detail: `${sl(l.season)} · ${fmt(pick(l.stats))} ${metric === "rating" ? "average rating" : metric} · ${l.stats.apps} apps, ${l.stats.minutes} min${l.current ? " (season in progress)" : ""}`,
  }));
  const tabs: { id: Metric; label: string }[] = [
    { id: "apps", label: "Apps" },
    { id: "minutes", label: "Minutes" },
    ...(gk ? [{ id: "cs" as const, label: "Clean sheets" }, { id: "saves" as const, label: "Saves" }] : [{ id: "goals" as const, label: "Goals" }, { id: "assists" as const, label: "Assists" }]),
    { id: "rating", label: "Avg rating" },
  ];
  return (
    <Card title="Career progression" action={<Tabs value={metric} onChange={setMetric} items={tabs} />}>
      <Columns items={items} height={130} label="Per-season progression" empty="Your seasons will chart here as they finish." max={metric === "rating" ? 6 : undefined} />
      {metric === "rating" && <p className="mt-1 text-[11px] text-muted">Rating columns start at 4.0, so differences between seasons are visible.</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------- earnings

export function EarningsPanel({ g }: { g: GameState }) {
  const ledger = g.user.pay;
  if (!ledger) return null;
  const order: PayKind[] = ["wage", "signing", "appearance", "goal", "assist", "cleanSheet", "trophy", "promotion", "other", "earlier"];
  const season = ledger.season.season === g.season ? ledger.season.amounts : {};
  const rows = order.filter((k) => (ledger.career[k] ?? 0) > 0);
  const seasonTotal = Object.values(season).reduce((s, v) => s + (v ?? 0), 0);
  return (
    <Card title="Earnings">
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="This season" value={formatMoney(seasonTotal)} tone="sun" />
        <Stat label="Career" value={formatMoney(g.user.earnings)} />
        <Stat label="In the bank" value={formatMoney(g.user.bank)} sub="after agent fees" />
      </div>
      <Table>
        <thead>
          <tr><th>Source</th><th className="text-right">This season</th><th className="text-right">Career</th></tr>
        </thead>
        <tbody>
          {rows.map((k) => (
            <tr key={k}>
              <td>{PAY_LABEL[k]}</td>
              <td className="text-right tabular-nums">{season[k] ? formatMoney(season[k] ?? 0) : "–"}</td>
              <td className="text-right font-bold tabular-nums">{formatMoney(ledger.career[k] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-2 text-[11px] text-muted">Every bonus is paid once, when its match, trophy or promotion happens. Agent fees and commission come out of the bank, not out of these totals.</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------- clarity

export function ClarityNote({ g }: { g: GameState }) {
  const r = g.user.reserves;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
      <Badge>Senior</Badge> All totals, averages and rankings on this page are senior appearances.
      {r && r.season === g.season && r.apps > 0 && (
        <span>
          Development squad this season: {r.apps} apps · {r.goals} goals · {r.assists} assists · avg {(r.ratingSum / r.apps).toFixed(2)} (kept separate).
        </span>
      )}
    </div>
  );
}
