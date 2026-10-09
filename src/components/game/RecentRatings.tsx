"use client";
import { useState } from "react";
import { RatingChart, type ChartMatch } from "@/components/game/RatingChart";
import { Badge, Tabs } from "@/components/ui";
import { formTrend, mean, ratedMatches, reserveForm } from "@/engine/stats/analytics";
import { isPartial } from "@/engine/stats/matchlog";
import type { GameState, MatchLogEntry } from "@/engine/types";

const TREND = { improving: { text: "Improving", tone: "pitch" as const }, stable: { text: "Stable", tone: "paper" as const }, declining: { text: "Declining", tone: "coral" as const } };

export function toChart(e: MatchLogEntry, g: GameState): ChartMatch {
  const partial = isPartial(e);
  return {
    key: e.fixtureId,
    season: e.season,
    turn: e.turn,
    rating: e.rating,
    opponent: e.opponent,
    comp: g.competitions[e.compId]?.shortName,
    minutes: partial ? undefined : e.minutes,
    goals: e.goals,
    assists: e.assists,
    result: partial ? undefined : `${e.result} ${e.score[0]}–${e.score[1]}${e.pens ? ` (${e.pens[0]}–${e.pens[1]} pens)` : ""}`,
    started: partial ? undefined : e.started,
  };
}

/** Recent ratings for the Dashboard's This Season card: the last ten rated games, with a development-squad toggle. */
export function RecentRatings({ g, count = 10 }: { g: GameState; count?: number }) {
  const [series, setSeries] = useState<"senior" | "dev">("senior");
  const senior = ratedMatches(g, count);
  const dev = reserveForm(g, count);
  const hasDev = dev.entries.length > 0;
  const all = ratedMatches(g).map((e) => e.rating);
  const trend = formTrend(all);
  const devChart: ChartMatch[] = dev.entries.map((e, i) => ({ key: `dev-${e.season}-${e.turn}-${i}`, season: e.season, turn: e.turn, rating: e.rating, opponent: "Development squad", goals: e.goals, assists: e.assists }));
  return (
    <div data-testid="recent-ratings">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase text-muted">Recent ratings</div>
        {hasDev && (
          <Tabs
            value={series}
            onChange={setSeries}
            items={[
              { id: "senior", label: "Senior" },
              { id: "dev", label: "Development" },
            ]}
          />
        )}
      </div>
      <RatingChart variant="line" matches={series === "senior" ? senior.map((e) => toChart(e, g)) : devChart} average={series === "senior" ? mean(senior.map((e) => e.rating)) : dev.average} label={series === "senior" ? "Senior match ratings" : "Development squad ratings"} />
      {series === "senior" && senior.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span>
            Average <b className="tabular-nums">{mean(senior.map((e) => e.rating)).toFixed(2)}</b> over {senior.length}
            {senior.length < count ? ` (of ${count} asked)` : ""}
          </span>
          {trend !== "unknown" ? <Badge tone={TREND[trend].tone}>{TREND[trend].text}</Badge> : <span className="text-muted">Trend needs 6 rated games</span>}
        </div>
      )}
      {series === "dev" && dev.entries.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Development squad games are kept apart: they are not part of your senior average. Average {dev.average.toFixed(2)} over {dev.entries.length}.
        </p>
      )}
      {senior.some((e) => isPartial(e)) && <p className="mt-1 text-[11px] text-muted">Older matches from before this version show ratings only: minutes and scores weren&apos;t recorded.</p>}
    </div>
  );
}
