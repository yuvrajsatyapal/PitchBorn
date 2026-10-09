"use client";
import { intlTeam } from "@/engine/national/identity";
import { useEffect, useRef, useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Card, CompChip, Empty, PageTitle, Rating, Tabs } from "@/components/ui";
import { formatTurnDate, seasonLabel } from "@/engine/calendar";
import { resultFor, scoreText, teamLabel, user, userFixtures } from "@/game/selectors";
import { useGameState } from "@/game/store";

// "22 Jul 2026" -> "Jul 2026"
const monthOf = (date: string) => date.replace(/^\d+\s/, "");
const dayOf = (date: string) => date.split(" ")[0];

export default function Schedule() {
  const g = useGameState();
  const [filter, setFilter] = useState("all");
  const nextRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    nextRef.current?.scrollIntoView({ block: "center" });
  }, [filter]);
  // Engine state is mutated in place, so derive on every render (no memo).
  const list = g ? userFixtures(g) : [];
  if (!g) return null;
  const p = user(g);
  const comps = [...new Map(list.map((x) => [x.comp.id, x.comp])).values()];
  const shown = list.filter((x) => filter === "all" || x.comp.id === filter);
  const nextId = shown.find((x) => !x.f.result && x.f.turn >= g.turn)?.f.id;
  const ratingFor = (fid: string) => list.find((x) => x.f.id === fid)?.f.result?.detail?.ratings[p.id];

  const months: { key: string; rows: typeof shown }[] = [];
  for (const row of shown) {
    const key = monthOf(formatTurnDate(g.season, row.f.turn));
    const last = months[months.length - 1];
    if (last?.key === key) last.rows.push(row);
    else months.push({ key, rows: [row] });
  }

  return (
    <div>
      <PageTitle kicker={seasonLabel(g.season)} title="Schedule" />
      <Tabs value={filter} onChange={setFilter} items={[{ id: "all", label: "All" }, ...comps.map((c) => ({ id: c.id, label: c.name }))]} className="mb-4" />
      <Card>
        {shown.length ? (
          <div className="grid gap-4">
            {months.map(({ key, rows }) => (
              <section key={key}>
                <h3 className="mb-1 text-[11px] font-black uppercase tracking-wider text-muted">{key}</h3>
                <ul className="divide-y divide-line/10">
                  {rows.map(({ comp, f }) => {
                    const team = f.home === p.clubId || f.away === p.clubId ? p.clubId! : intlTeam(p);
                    const home = f.home === team;
                    const opp = home ? f.away : f.home;
                    const res = resultFor(f, team);
                    const isNext = f.id === nextId;
                    return (
                      <li
                        key={f.id}
                        ref={isNext ? nextRef : undefined}
                        className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-2 py-2 text-sm sm:grid-cols-[2.5rem_11rem_minmax(0,1fr)_auto] ${isNext ? "rounded-xl bg-sun-2 ring-2 ring-sun" : ""}`}
                      >
                        <span className={`num text-center text-base leading-none sm:row-span-1 row-span-2`}>{dayOf(formatTurnDate(g.season, f.turn))}</span>
                        <span className="col-start-2 row-start-1 flex min-w-0 items-center gap-2 sm:col-start-3">
                          <Crest clubId={opp} size={22} />
                          <span className="truncate font-semibold">{teamLabel(opp)}</span>
                          <span className="text-xs text-muted">{f.neutral ? "N" : home ? "H" : "A"}</span>
                        </span>
                        <CompChip
                          comp={comp}
                          stage={f.stage}
                          stacked
                          full
                          className="col-start-2 row-start-2 pl-[30px] sm:col-start-2 sm:row-start-1 sm:pl-0"
                        />
                        <span className={`col-start-3 row-start-1 flex items-center justify-end gap-2 sm:col-start-4 row-span-2 sm:row-span-1`}>
                          {f.result ? (
                            <>
                              <span className={`rounded-md border-2 border-line px-1.5 text-xs font-black tabular-nums ${res === "W" ? "bg-pitch text-white" : res === "L" ? "bg-coral" : "bg-sun"}`}>{scoreText(f)}</span>
                              <Rating v={ratingFor(f.id)} size="sm" />
                            </>
                          ) : isNext ? (
                            <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-paper">Next</span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <Empty title="No fixtures scheduled" icon="📅">
            New fixtures appear when the season starts or cup draws are made.
          </Empty>
        )}
      </Card>
    </div>
  );
}
