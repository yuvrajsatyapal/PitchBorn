"use client";
import { useState } from "react";
import { InlineAdSlot } from "@/ads/AdSlot";
import { Crest } from "@/components/art/Crest";
import { Flag } from "@/components/art/Flag";
import { RunBadge } from "@/components/game/CompetitionRun";
import { LeagueTable } from "@/components/game/LeagueTable";
import { Badge, Card, Empty, PageTitle, Table, Tabs } from "@/components/ui";
import { seasonLabel } from "@/engine/calendar";
import { leagueCompId } from "@/engine/competitions/setup";
import { WORLD, country, leaguesInPlay } from "@/engine/data/world";
import type { Competition } from "@/engine/types";
import { name, scoreText, teamLabel, user } from "@/game/selectors";
import { useGameState } from "@/game/store";

type View = "league" | "cups" | "continental" | "international" | "history";

function KnockoutRounds({ comp, highlight }: { comp: Competition; highlight: string[] }) {
  const ko = comp.fixtures.filter((f) => f.group === undefined);
  const rounds = [...new Set(ko.map((f) => f.round))].sort((a, b) => b - a);
  if (!rounds.length) return <p className="text-sm text-muted">Knockout draw not made yet.</p>;
  return (
    <div className="grid gap-3">
      {rounds.map((r) => {
        const fs = ko.filter((f) => f.round === r);
        return (
          <div key={r}>
            <div className="mb-1 text-xs font-black uppercase text-muted">{fs[0].stage}</div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {fs.map((f) => (
                <li key={f.id} className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1 text-sm ${highlight.includes(f.home) || highlight.includes(f.away) ? "border-line bg-sun-2" : "border-line/15"}`}>
                  <Crest clubId={f.home} size={18} />
                  <span className="min-w-0 flex-1 truncate">{teamLabel(f.home, true)}</span>
                  <span className="scoreboard text-xs">{f.result ? scoreText(f) : "v"}</span>
                  <span className="min-w-0 flex-1 truncate text-right">{teamLabel(f.away, true)}</span>
                  <Crest clubId={f.away} size={18} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function GroupTables({ comp, highlight }: { comp: Competition; highlight: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {comp.groups?.map((gr) => (
        <div key={gr.name}>
          <div className="mb-1 font-display text-lg">{gr.name}</div>
          <LeagueTable rows={gr.table} highlight={highlight.find((h) => gr.teams.includes(h))} promo={2} showForm={false} />
        </div>
      ))}
    </div>
  );
}

export default function Competitions() {
  const g = useGameState();
  const p = g ? user(g) : null;
  const myLeague = p?.clubId && g ? g.clubs[p.clubId]?.leagueId : undefined;
  const [view, setView] = useState<View>("league");
  const [leagueId, setLeagueId] = useState<string>(myLeague ?? "eng-1");
  const [histKey, setHistKey] = useState<string>("");
  const leagues = g ? leaguesInPlay(g) : [];
  if (!g || !p) return null;
  const comp = g.competitions[leagueCompId(leagueId, g.season)];
  const lg = WORLD.leagues.find((l) => l.id === leagueId);
  const highlight = [p.clubId ?? "", p.intl.tiedTo ?? p.nationality];
  const cups = Object.values(g.competitions).filter((c) => c.kind === "cup");
  const conts = Object.values(g.competitions).filter((c) => c.kind === "continental");
  const intl = Object.values(g.competitions).filter((c) => c.kind === "international" && c.groups);
  const realHistory = WORLD.history.filter((h) => h.leagueId === leagueId);
  const archive = [...g.archive].reverse();
  const scorers = comp
    ? Object.values(g.players)
        .filter((x) => (x.season[comp.id]?.goals ?? 0) > 0)
        .sort((a, b) => (b.season[comp.id]?.goals ?? 0) - (a.season[comp.id]?.goals ?? 0))
        .slice(0, 10)
    : [];
  return (
    <div>
      <PageTitle kicker={seasonLabel(g.season)} title="Competitions" />
      <Tabs
        value={view}
        onChange={setView}
        className="mb-4"
        items={[
          { id: "league", label: "Leagues" },
          { id: "cups", label: "Domestic cups" },
          { id: "continental", label: "Continental" },
          { id: "international", label: "International" },
          { id: "history", label: "History" },
        ]}
      />
      {view === "league" && (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)} className="rounded-full border-2 border-line bg-card px-3 py-2 text-sm font-bold" aria-label="League">
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {country(l.countryCode)?.name} · {l.name}
                </option>
              ))}
            </select>
            {myLeague && leagueId !== myLeague && (
              <button className="rounded-full border-2 border-line bg-sun-2 px-3 text-sm font-bold" onClick={() => setLeagueId(myLeague)}>
                My league
              </button>
            )}
          </div>
          {comp?.table ? (
            <Card title={<span className="flex items-center gap-2"><Flag code={lg?.countryCode} /> {comp.name}</span>} action={lg?.abstraction ? <Badge>single-table abstraction</Badge> : undefined}>
              <LeagueTable rows={comp.table} highlight={p.clubId} promo={lg && lg.tier > 1 ? 3 : 0} continental={lg?.tier === 1 ? 3 : 0} releg={lg && lg.tier < 3 ? 3 : 0} />
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                {lg?.tier === 1 && <span><span className="inline-block h-2 w-2 bg-sky" /> Champions Cup</span>}
                {lg && lg.tier > 1 && <span><span className="inline-block h-2 w-2 bg-pitch" /> Promotion</span>}
                {lg && lg.tier < 3 && <span><span className="inline-block h-2 w-2 bg-coral" /> Relegation</span>}
              </div>
            </Card>
          ) : (
            <Empty title="No table this season" />
          )}
          <InlineAdSlot placementId="below-table" />
          <Card title="Top scorers">
            {scorers.length ? (
              <Table>
                <tbody>
                  {scorers.map((x, i) => (
                    <tr key={x.id} className={x.isUser ? "bg-sun-2 font-bold" : ""}>
                      <td className="w-6">{i + 1}</td>
                      <td>
                        <span className="flex items-center gap-1.5"><Flag code={x.nationality} /> {name(x)}</span>
                      </td>
                      <td><span className="flex items-center gap-1.5"><Crest clubId={x.clubId} size={16} /> {teamLabel(x.clubId ?? "", true)}</span></td>
                      <td className="text-right font-black">{x.season[comp!.id]?.goals}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="text-sm text-muted">No goals yet.</p>
            )}
          </Card>
        </div>
      )}
      {view === "cups" && (
        <div className="grid gap-4">
          {cups.length ? cups.map((c) => (
            <Card key={c.id} title={<span className="flex items-center gap-2"><Flag code={c.countryCode} /> {c.name}</span>} action={c.winner ? <Badge tone="sun">🏆 {teamLabel(c.winner, true)}</Badge> : undefined}>
              {p.clubId && <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><span className="font-bold">Your club:</span><RunBadge comp={c} teamId={p.clubId} /></div>}
              <KnockoutRounds comp={c} highlight={highlight} />
            </Card>
          )) : <Empty title="Cups start soon" />}
        </div>
      )}
      {view === "continental" && (
        <div className="grid gap-4">
          {conts.length ? conts.map((c) => (
            <Card key={c.id} title={c.name} action={c.winner ? <Badge tone="sun">🏆 {teamLabel(c.winner, true)}</Badge> : undefined}>
              {p.clubId && <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><span className="font-bold">Your club:</span><RunBadge comp={c} teamId={p.clubId} /></div>}
              <GroupTables comp={c} highlight={highlight} />
              <div className="mt-4"><KnockoutRounds comp={c} highlight={highlight} /></div>
            </Card>
          )) : <Empty title="No continental competition this season" icon="🌌" />}
        </div>
      )}
      {view === "international" && (
        <div className="grid gap-4">
          {intl.length ? intl.map((c) => (
            <Card key={c.id} title={c.name} action={c.winner ? <Badge tone="sun">🏆 {teamLabel(c.winner)}</Badge> : undefined}>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><span className="font-bold">Your country:</span><RunBadge comp={c} teamId={p.intl.tiedTo ?? p.nationality} /></div>
              <GroupTables comp={c} highlight={highlight} />
              <div className="mt-4"><KnockoutRounds comp={c} highlight={highlight} /></div>
            </Card>
          )) : <Empty title="No tournament this summer" icon="🌍">Major tournaments are held in even years after the club season.</Empty>}
        </div>
      )}
      {view === "history" && (
        <div className="grid gap-4">
          <Card title="Pitchborn seasons">
            {archive.length ? (
              <Table>
                <thead><tr><th>Season</th><th>Competition</th><th>Winner</th><th>Runner-up</th></tr></thead>
                <tbody>
                  {archive.flatMap((a) =>
                    Object.entries(a.champions).filter(([id]) => !id.includes("-3-") && !id.includes("-2-")).map(([id, c]) => (
                      <tr key={`${a.season}-${id}`}>
                        <td>{seasonLabel(a.season)}</td>
                        <td>{c.name}</td>
                        <td><span className="flex items-center gap-1.5"><Crest clubId={c.winner} size={16} /> {teamLabel(c.winner, true)}</span></td>
                        <td>{c.runnerUp ? teamLabel(c.runnerUp, true) : "—"}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </Table>
            ) : <p className="text-sm text-muted">Your first season will be recorded here.</p>}
          </Card>
          <Card title={`Real history · ${lg?.name}`} action={<select value={histKey} onChange={(e) => setHistKey(e.target.value)} className="rounded-full border-2 border-line bg-card px-2 py-1 text-sm" aria-label="Season">{realHistory.map((h) => <option key={h.season} value={h.season}>{h.season}</option>)}</select>}>
            {(() => {
              const h = realHistory.find((x) => x.season === histKey) ?? realHistory[realHistory.length - 1];
              if (!h) return <p className="text-sm text-muted">No open historical data for this division.</p>;
              return (
                <>
                  <p className="mb-2 text-xs text-muted">Final table computed from real results ({h.matches} matches, {h.goals} goals) · source: OpenFootball (CC0).</p>
                  <LeagueTable rows={h.table.map((r) => ({ team: r.clubId ?? r.team, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost, gf: r.gf, ga: r.ga, points: r.points, form: [] }))} showForm={false} />
                </>
              );
            })()}
          </Card>
        </div>
      )}
    </div>
  );
}
