"use client";
import { useMemo, useState } from "react";
import { Crest } from "@/components/art/Crest";
import { BracketView, RoundList, TieCard } from "@/components/game/Bracket";
import { RunBadge } from "@/components/game/CompetitionRun";
import { Badge, Tabs } from "@/components/ui";
import { buildBracket, journeyOf, resultNote } from "@/engine/competitions/bracket";
import type { Competition, Fixture } from "@/engine/types";
import { resultFor, scoreText, teamLabel } from "@/game/selectors";

function Winner({ comp, final }: { comp: Competition; final?: Fixture }) {
  if (!comp.winner) return null;
  const note = final ? resultNote(final, (id) => teamLabel(id, true)) : null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border-2 border-line bg-sun-2 p-3" data-testid="competition-winner">
      <span className="text-3xl" aria-hidden>🏆</span>
      <Crest clubId={comp.winner} size={44} />
      <div className="min-w-0 flex-1">
        <div className="font-display text-xl leading-tight">{teamLabel(comp.winner)}</div>
        <div className="text-xs text-ink-2">Winners of the {comp.name}</div>
        {final?.result && (
          <div className="mt-0.5 text-xs">
            Final: {teamLabel(final.home, true)} <b className="scoreboard">{scoreText(final)}</b> {teamLabel(final.away, true)}
            {note?.text ? ` · ${note.text}` : ""}
          </div>
        )}
      </div>
      {comp.runnerUp && (
        <div className="flex items-center gap-1.5 text-xs text-ink-2">
          <Crest clubId={comp.runnerUp} size={22} /> Runners-up: <b>{teamLabel(comp.runnerUp, true)}</b>
        </div>
      )}
    </div>
  );
}

/**
 * A knockout competition: the winner (once decided), your club's journey, a connected bracket for the later rounds and
 * collapsible lists for the early ones. All of it is read from the saved fixtures.
 */
export function KnockoutView({ comp, highlight, myTeam }: { comp: Competition; highlight: string[]; myTeam: string | null }) {
  const sig = `${comp.fixtures.length}:${comp.fixtures.filter((f) => f.result).length}:${comp.winner ?? ""}`;
  const bracket = useMemo(() => buildBracket(comp), [comp.id, sig]); // eslint-disable-line react-hooks/exhaustive-deps
  // Phones get the round-by-round view first; the bracket stays one tap away and scrolls sideways. (This only renders
  // once a game is loaded in the browser, so reading the screen width here cannot disagree with the server.)
  const [view, setView] = useState<"bracket" | "rounds">(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "rounds" : "bracket"));
  const [onlyMine, setOnlyMine] = useState(false);
  const [round, setRound] = useState<string>("");
  if (!bracket) return <p className="text-sm text-muted">Knockout draw not made yet.</p>;
  const j = myTeam ? journeyOf(comp, myTeam) : null;
  const all = [...bracket.earlier.map((e) => ({ id: String(e.round), stage: e.stage, fixtures: e.fixtures })), ...bracket.rounds.filter((r) => !r.pending).map((r) => ({ id: String(r.round), stage: r.stage, fixtures: r.ties.map((t) => t.fixture) }))];
  const current = all.find((r) => r.id === round) ?? all[all.length - 1];
  const finalRound = bracket.rounds.filter((r) => !r.pending).pop();
  const final = comp.winner && finalRound?.ties.length === 1 ? finalRound.ties[0].fixture : undefined;
  const mine = j && j.entered ? j.played.filter((f) => f.group === undefined) : [];
  const stagesReached = j?.stage;
  return (
    <div className="grid gap-3" data-testid="knockout-view">
      <Winner comp={comp} final={final} />
      {myTeam && j?.entered && (
        <div className="rounded-xl border-2 border-line/30 p-2.5 text-sm" data-testid="my-journey">
          <div className="flex flex-wrap items-center gap-2">
            <b>Your {myTeam.length === 3 && !comp.teams.includes(myTeam) ? "side" : "club"}:</b>
            <RunBadge comp={comp} teamId={myTeam} />
            {stagesReached && j.status !== "alive" && <Badge>Best run: {stagesReached}</Badge>}
            {j.next && <Badge tone="sky">Next: {j.next.stage} vs {teamLabel(j.next.home === myTeam ? j.next.away : j.next.home, true)}</Badge>}
          </div>
          {mine.length > 0 && (
            <ol className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {mine.map((f) => {
                const home = f.home === myTeam;
                const r = f.result;
                const res = resultFor(f, myTeam);
                const note = resultNote(f, (id) => teamLabel(id, true));
                return (
                  <li key={f.id} className="rounded-md border-2 border-line/20 bg-card px-1.5 py-0.5">
                    <span className="text-muted">{f.stage}:</span>{" "}
                    <span className={`inline-block rounded border border-line px-1 font-black ${res === "W" ? "bg-pitch text-white" : "bg-coral"}`}>{res}</span>{" "}
                    <b className="scoreboard">{r ? (home ? `${r.hg}–${r.ag}` : `${r.ag}–${r.hg}`) : ""}</b> {home ? "v" : "at"} {teamLabel(home ? f.away : f.home, true)}
                    {note.text ? <span className="text-muted"> · {note.text}</span> : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { id: "bracket", label: "Bracket" },
            { id: "rounds", label: "By round" },
          ]}
        />
        {myTeam && (
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="h-4 w-4 accent-[var(--pitch)]" /> My club only
          </label>
        )}
      </div>
      {view === "bracket" ? (
        <>
          {onlyMine ? (
            <p className="text-xs text-muted">Showing your club&apos;s ties only. Switch off the filter to see the bracket.</p>
          ) : (
            <BracketView bracket={bracket} highlight={highlight} />
          )}
          {bracket.earlier.length > 0 && (
            <div className="grid gap-1.5">
              <div className="text-xs font-black uppercase text-muted">Earlier rounds</div>
              {bracket.earlier.map((e) => (
                <RoundList key={e.round} title={e.stage} fixtures={e.fixtures} highlight={highlight} onlyMine={onlyMine} />
              ))}
            </div>
          )}
          {onlyMine &&
            bracket.rounds
              .filter((r) => !r.pending)
              .map((r) => <RoundList key={r.round} title={r.stage} fixtures={r.ties.map((t) => t.fixture)} highlight={highlight} onlyMine defaultOpen />)}
        </>
      ) : (
        <>
          <Tabs value={current.id} onChange={setRound} items={all.map((r) => ({ id: r.id, label: r.stage }))} />
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="round-view">
            {(onlyMine ? current.fixtures.filter((f) => highlight.includes(f.home) || highlight.includes(f.away)) : current.fixtures).slice(0, 80).map((f) => (
              <li key={f.id}>
                <TieCard tie={{ fixture: f, winner: null, from: [null, null], y: 0 }} highlight={highlight} />
              </li>
            ))}
          </ul>
          {current.fixtures.length > 80 && !onlyMine && <p className="text-xs text-muted">Showing the first 80 of {current.fixtures.length} ties. Use &quot;My club only&quot; to find your tie.</p>}
        </>
      )}
    </div>
  );
}
