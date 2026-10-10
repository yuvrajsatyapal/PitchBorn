"use client";
import { useState } from "react";
import { RivalStatsCard } from "@/components/game/RivalCards";
import { Crest } from "@/components/art/Crest";
import { Card, PageTitle, Stat, Table, Tabs } from "@/components/ui";
import { seasonLabel } from "@/engine/calendar";
import { clubName } from "@/engine/data/world";
import { addStat, avgRating, emptyStat } from "@/engine/players/generate";
import type { StatLine } from "@/engine/types";
import { keeperMetrics } from "@/engine/players/keeper";
import { seasonTotal, user } from "@/game/selectors";
import { useGame, useGameState } from "@/game/store";
import { ClarityNote, EarningsPanel, FormPanel, Per90Panel, ProgressionPanel, RankingPanel, RecordsPanel, SplitsPanel, TimelinePanel } from "@/components/game/StatsPanels";

function Row({ label, s, extra }: { label: React.ReactNode; s: StatLine; extra?: React.ReactNode }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="text-right">{s.apps}</td>
      <td className="hidden text-right sm:table-cell">{s.starts}</td>
      <td className="hidden text-right md:table-cell">{s.minutes}</td>
      <td className="text-right font-bold">{s.goals}</td>
      <td className="text-right">{s.assists}</td>
      <td className="hidden text-right sm:table-cell">{s.cleanSheets}</td>
      <td className="hidden text-right md:table-cell">{s.yellow}/{s.red}</td>
      <td className="hidden text-right lg:table-cell">{s.motm}</td>
      <td className="text-right">{s.apps ? avgRating(s).toFixed(2) : "–"}</td>
      {extra}
    </tr>
  );
}

function Head({ first }: { first: string }) {
  return (
    <thead>
      <tr>
        <th>{first}</th>
        <th className="text-right">Apps</th>
        <th className="hidden text-right sm:table-cell">Starts</th>
        <th className="hidden text-right md:table-cell">Mins</th>
        <th className="text-right">G</th>
        <th className="text-right">A</th>
        <th className="hidden text-right sm:table-cell">CS</th>
        <th className="hidden text-right md:table-cell">Cards</th>
        <th className="hidden text-right lg:table-cell">MotM</th>
        <th className="text-right">Avg</th>
      </tr>
    </thead>
  );
}

export default function Stats() {
  const g = useGameState();
  const version = useGame((st) => st.version);
  const [view, setView] = useState<"season" | "career" | "clubs" | "competitions">("season");
  if (!g) return null;
  const p = user(g);
  const cur = seasonTotal(p);
  const byClub = new Map<string, StatLine>();
  const byComp = new Map<string, { name: string; s: StatLine }>();
  for (const h of p.history) {
    if (h.clubId) {
      const s = byClub.get(h.clubId) ?? emptyStat();
      addStat(s, h.stats);
      byClub.set(h.clubId, s);
    }
    for (const [k, s] of Object.entries(h.byCompetition ?? {})) {
      const key = k.replace(/-\d{4}$/, "");
      const e = byComp.get(key) ?? { name: key, s: emptyStat() };
      addStat(e.s, s);
      byComp.set(key, e);
    }
  }
  for (const [k, s] of Object.entries(p.season)) {
    const key = k.replace(/-\d{4}$/, "");
    const e = byComp.get(key) ?? { name: g.competitions[k]?.name ?? key, s: emptyStat() };
    e.name = g.competitions[k]?.name ?? e.name;
    addStat(e.s, s);
    byComp.set(key, e);
    if (p.clubId && g.competitions[k]?.kind !== "international") {
      const c = byClub.get(p.clubId) ?? emptyStat();
      addStat(c, s);
      byClub.set(p.clubId, c);
    }
  }
  const compName = (key: string, fallback: string) => {
    if (key.startsWith("cup-")) return fallback.startsWith("cup-") ? "Domestic cup" : fallback;
    if (key.startsWith("ccup")) return "Champions Cup";
    if (key.startsWith("ecup")) return "Continental Cup";
    if (key.startsWith("intl")) return "International matches";
    if (key.startsWith("world")) return "World Championship";
    if (key.startsWith("euro")) return "European Nations Championship";
    return fallback;
  };
  return (
    <div className="grid gap-4">
      <PageTitle kicker="Numbers don't lie" title="Statistics" className="-mb-1" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Career apps" value={p.career.apps} />
        <Stat label="Career goals" value={p.career.goals} tone="pitch" />
        <Stat label="Career assists" value={p.career.assists} tone="sky" />
        <Stat label="Avg rating" value={p.career.apps ? avgRating(p.career).toFixed(2) : "–"} tone="sun" />
        <Stat label="Caps / goals" value={`${p.intl.caps} / ${p.intl.goals}`} />
        <Stat label="Trophies" value={g.user.trophies.length} tone="plum" />
      </div>
      <Tabs value={view} onChange={setView} items={[{ id: "season", label: "This season" }, { id: "career", label: "By season" }, { id: "clubs", label: "By club" }, { id: "competitions", label: "By competition" }]} />
      <Card>
        <Table>
          <Head first={view === "clubs" ? "Club" : view === "competitions" ? "Competition" : view === "career" ? "Season" : "Competition"} />
          <tbody>
            {view === "season" && (
              <>
                {Object.entries(p.season).map(([k, s]) => <Row key={k} label={g.competitions[k]?.name ?? k} s={s} />)}
                <Row label={<b>Total</b>} s={cur} />
              </>
            )}
            {view === "career" && (
              <>
                {[...p.history].reverse().map((h) => (
                  <Row key={h.season} label={<span className="flex items-center gap-1.5">{seasonLabel(h.season)} <Crest clubId={h.clubId} size={16} /></span>} s={h.stats} />
                ))}
                <Row label={<b>Career</b>} s={p.career} />
              </>
            )}
            {view === "clubs" && [...byClub.entries()].map(([id, s]) => <Row key={id} label={<span className="flex items-center gap-1.5"><Crest clubId={id} size={16} /> {clubName(id)}</span>} s={s} />)}
            {view === "competitions" && [...byComp.entries()].map(([k, e]) => <Row key={k} label={compName(k, e.name)} s={e.s} />)}
          </tbody>
        </Table>
        <p className="mt-2 text-xs text-muted">Pre-career totals are not included in breakdowns; career totals count every senior match.</p>
      </Card>
      <ClarityNote g={g} />
      <FormPanel g={g} version={version} />
      <Per90Panel g={g} />
      <TimelinePanel g={g} version={version} />
      <ProgressionPanel g={g} />
      <RankingPanel g={g} version={version} />
      <RecordsPanel g={g} />
      <SplitsPanel g={g} version={version} />
      <EarningsPanel g={g} />
      <RivalStatsCard g={g} />
      <Card title="Detailed this season">
        {cur.apps === 0 ? (
          <p className="text-sm text-muted">Nothing to show yet. These fill in after your first appearance of the season.</p>
        ) : (
          <div className={`grid grid-cols-2 gap-2 ${p.position === "GK" ? "lg:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-6"}`}>
            {p.position === "GK" ? (
              <>
                <Stat tone="pitch" label="Clean sheets" value={cur.cleanSheets} sub={`${Math.round(keeperMetrics(cur).cleanSheetRate * 100)}% of games`} />
                <Stat tone="sky" label="Save %" value={cur.saves + cur.conceded ? `${Math.round(keeperMetrics(cur).savePct * 100)}%` : "–"} sub={`${cur.saves} saves, ${cur.conceded} conceded`} />
                <Stat label="Conceded / 90" value={cur.minutes ? keeperMetrics(cur).concededPer90.toFixed(2) : "–"} sub="lower is better" />
                <Stat label="Saves / game" value={keeperMetrics(cur).savesPerGame.toFixed(1)} sub={`over ${cur.apps} ${cur.apps === 1 ? "game" : "games"}`} />
              </>
            ) : (
              <>
                <Stat tone="pitch" label="Goal involvements" value={cur.goals + cur.assists} sub={`${cur.goals} goals, ${cur.assists} assists`} />
                <Stat label="Shots" value={cur.shots} sub={cur.shots ? `${cur.shotsOnTarget} on target (${Math.round((cur.shotsOnTarget / cur.shots) * 100)}%)` : "none yet"} />
                <Stat tone="sun" label="Conversion" value={cur.shots ? `${Math.round((cur.goals / cur.shots) * 100)}%` : "–"} sub={cur.shots ? `${cur.goals} from ${cur.shots} shots` : "needs a shot"} />
                <Stat label="Mins / goal" value={cur.goals ? Math.round(cur.minutes / cur.goals) : "–"} sub={cur.goals ? `${cur.minutes.toLocaleString()} mins played` : "no goals yet"} />
                <Stat tone="sky" label="Key passes" value={cur.keyPasses} sub={`${(cur.keyPasses / cur.apps).toFixed(1)} per game`} />
                <Stat label="Tackles" value={cur.tackles} sub={`${(cur.tackles / cur.apps).toFixed(1)} per game`} />
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
