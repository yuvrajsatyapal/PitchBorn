"use client";
import { useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Card, Empty, PageTitle, Rating, Tabs } from "@/components/ui";
import { formatTurnDate, seasonLabel } from "@/engine/calendar";
import { resultFor, scoreText, teamLabel, user, userFixtures } from "@/game/selectors";
import { useGameState } from "@/game/store";

export default function Schedule() {
  const g = useGameState();
  const [filter, setFilter] = useState("all");
  // Engine state is mutated in place, so derive on every render (no memo).
  const list = g ? userFixtures(g) : [];
  if (!g) return null;
  const p = user(g);
  const comps = [...new Map(list.map((x) => [x.comp.id, x.comp])).values()];
  const shown = list.filter((x) => filter === "all" || x.comp.id === filter);
  const ratingFor = (fid: string) => g.competitions && list.find((x) => x.f.id === fid)?.f.result?.detail?.ratings[p.id];
  return (
    <div>
      <PageTitle kicker={seasonLabel(g.season)} title="Schedule" />
      <Tabs value={filter} onChange={setFilter} items={[{ id: "all", label: "All" }, ...comps.map((c) => ({ id: c.id, label: c.name }))]} className="mb-4" />
      <Card>
        {shown.length ? (
          <ul className="divide-y divide-line/10">
            {shown.map(({ comp, f }) => {
              const team = f.home === p.clubId || f.away === p.clubId ? p.clubId! : p.intl.tiedTo ?? p.nationality;
              const home = f.home === team;
              const opp = home ? f.away : f.home;
              const res = resultFor(f, team);
              const isNext = !f.result && f.turn >= g.turn && shown.find((x) => !x.f.result)?.f.id === f.id;
              return (
                <li key={f.id} className={`flex flex-wrap items-center gap-3 py-2 text-sm ${isNext ? "rounded-xl bg-sun-2 px-2" : ""}`}>
                  <span className="w-24 shrink-0 text-xs text-muted">{formatTurnDate(g.season, f.turn)}</span>
                  <span className="w-28 shrink-0 truncate text-xs font-bold">
                    {comp.shortName}
                    {f.stage ? ` · ${f.stage}` : ""}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <Crest clubId={opp} size={22} />
                    <span className="truncate font-semibold">{teamLabel(opp)}</span>
                    <span className="text-muted">{f.neutral ? "(N)" : home ? "(H)" : "(A)"}</span>
                  </span>
                  {f.result ? (
                    <>
                      <span className={`rounded-md border-2 border-line px-1.5 text-xs font-black ${res === "W" ? "bg-pitch text-white" : res === "L" ? "bg-coral" : "bg-sun"}`}>{scoreText(f)}</span>
                      <Rating v={ratingFor(f.id)} size="sm" />
                    </>
                  ) : (
                    <span className="text-xs text-muted">{isNext ? "Next" : "—"}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No fixtures scheduled" icon="📅">
            New fixtures appear when the season starts or cup draws are made.
          </Empty>
        )}
      </Card>
    </div>
  );
}
