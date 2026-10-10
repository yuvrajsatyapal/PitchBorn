"use client";
import Link from "next/link";
import { useState } from "react";
import { Crest } from "@/components/art/Crest";
import { LiveMatch } from "@/components/game/LiveMatch";
import { TeamStatBars } from "@/components/game/match/MatchStats";
import { PostMatchCard } from "@/components/game/match/PostMatchCard";
import { rivalHref } from "@/components/game/RivalCards";
import { MemoryLane } from "@/components/game/VaultCard";
import { matchPreview } from "@/engine/career/rivalry/engine";
import { rivalryLevel } from "@/engine/memory/rivalry";
import { Badge, Button, Card, Empty, PageTitle, Rating } from "@/components/ui";
import { seasonLabel } from "@/engine/calendar";
import type { Fixture, GameState } from "@/engine/types";
import { name, scoreText, teamLabel, user, userFixtures } from "@/game/selectors";
import { canRequestRest } from "@/engine/season/advance";
import { matchStatus } from "@/engine/season/selection";
import { FormerManagerBlock, MatchContextStrip, MatchPreviewPanel, SelectionBlock } from "@/components/game/MatchBriefing";
import { useGame, useGameState } from "@/game/store";

function derbyLevel(g: GameState, f: Fixture): number {
  const me = user(g).clubId;
  if (!me || (f.home !== me && f.away !== me)) return 0;
  return rivalryLevel(g, me, f.home === me ? f.away : f.home);
}

/** The match in a few lines and a goal timeline, built from the stored result: fills the gap beside a long stats column. */
function MatchStory({ g, f }: { g: GameState; f: Fixture }) {
  const d = f.result?.detail;
  const goals = f.result?.goals ?? [];
  if (!d) return null;
  const home = teamLabel(f.home, true);
  const away = teamLabel(f.away, true);
  const end = Math.max(90, ...goals.map((x) => x.minute + 3));
  const hg = f.result?.hg ?? 0;
  const ag = f.result?.ag ?? 0;
  const lines: string[] = [];
  const dxg = d.xg[0] - d.xg[1];
  if (Math.abs(dxg) >= 0.4) {
    const better = dxg > 0 ? home : away;
    const won = dxg > 0 ? hg > ag : ag > hg;
    lines.push(hg === ag ? `${better} created the better chances (xG ${d.xg[0]} v ${d.xg[1]}) but could not separate the sides.` : won ? `${better} had the better chances (xG ${d.xg[0]} v ${d.xg[1]}) and the result to show for it.` : `${better} created more (xG ${d.xg[0]} v ${d.xg[1]}) but did not win.`);
  } else lines.push(`An even contest on chances (xG ${d.xg[0]} v ${d.xg[1]}).`);
  if (Math.abs(d.possession[0] - d.possession[1]) >= 12) lines.push(`${d.possession[0] > d.possession[1] ? home : away} controlled the ball with ${Math.max(...d.possession)}% possession.`);
  if (goals.some((x) => x.penalty)) lines.push("A penalty decided part of the story.");
  const cards = d.yellows[0] + d.yellows[1] + d.reds[0] + d.reds[1];
  if (d.reds[0] + d.reds[1] > 0) lines.push(`A sending-off changed the match (${cards} cards in all).`);
  else if (cards >= 5) lines.push(`A feisty game: ${cards} cards and ${d.fouls[0] + d.fouls[1]} fouls.`);
  const u = d.userLine;
  if (u && u.minuteOn >= 0) {
    const mins = Math.max(0, (u.minuteOff ?? 90) - u.minuteOn);
    lines.push(`You played ${mins} minutes and were rated ${u.rating.toFixed(1)}${f.result?.motm === g.user.playerId ? ", Player of the Match" : ""}.`);
  }
  return (
    <Card title="Match story">
      <div className="relative mx-1 mb-6 mt-5 h-2 rounded-full border-2 border-line bg-paper-2">
        {goals.map((gl, i) => (
          <span
            key={i}
            title={`${g.players[gl.scorer]?.lastName ?? "Goal"} ${gl.minute}'`}
            className={`absolute -top-2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border-2 border-line text-[9px] font-black ${gl.side === "home" ? "bg-pitch text-white" : "bg-coral"}`}
            style={{ left: `${Math.min(98, (gl.minute / end) * 100)}%` }}
          >
            {gl.minute}
          </span>
        ))}
        <span className="absolute left-1/2 top-3 -translate-x-1/2 text-[10px] font-bold text-muted">HT</span>
        <span className="absolute left-0 top-3 text-[10px] font-bold text-muted">0&apos;</span>
        <span className="absolute right-0 top-3 text-[10px] font-bold text-muted">{end}&apos;</span>
      </div>
      <ul className="grid gap-1.5 text-sm text-ink-2">
        {lines.map((t) => (
          <li key={t}>• {t}</li>
        ))}
      </ul>
    </Card>
  );
}

function ResultSummary({ g, f }: { g: GameState; f: Fixture }) {
  const comp = g.competitions[f.compId];
  const d = f.result?.detail;
  const goals = f.result?.goals ?? [];
  const club = comp?.kind !== "international" && comp?.kind !== "friendly";
  const uid = g.user.playerId;
  const sideOf = (id: string): "home" | "away" | null => {
    const p = g.players[id];
    const team = p ? [p.clubId, p.nationality].find((x) => x === f.home || x === f.away) : undefined;
    return team === f.home ? "home" : team === f.away ? "away" : null;
  };
  const rated = d ? Object.entries(d.ratings).map(([id, r]) => ({ p: g.players[id], r, side: sideOf(id) })).filter((x) => x.p) : [];
  const byGoals = (id: string) => goals.filter((x) => x.scorer === id).length;
  const byAssists = (id: string) => goals.filter((x) => x.assist === id).length;
  const column = (side: "home" | "away") => rated.filter((x) => x.side === side).sort((a, b) => b.r - a.r);
  const mine = d?.userLine ? sideOf(uid) ?? d.userLine.side : null;
  const scorerLine = (side: "home" | "away") =>
    goals
      .filter((gl) => gl.side === side)
      .map((gl, i) => (
        <li key={i} className={side === "home" ? "text-left" : "text-right"}>
          ⚽ {g.players[gl.scorer]?.squadNo !== undefined && club ? `#${g.players[gl.scorer].squadNo} ` : ""}
          {g.players[gl.scorer] ? name(g.players[gl.scorer]) : "—"} {gl.minute}&apos;{gl.penalty ? " (pen)" : ""}
          {gl.assist && g.players[gl.assist] ? <span className="opacity-70"> · assist {g.players[gl.assist].lastName}</span> : null}
        </li>
      ));
  return (
    <div className="grid gap-4">
      <Card className="!bg-[#1b1712] !text-[#fff5e6]" flat>
        <div className="text-center text-xs font-bold uppercase tracking-widest text-sun/80">
          {comp?.name} {f.stage ? `· ${f.stage}` : ""} · Full time
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <Crest clubId={f.home} size={56} />
            <span className="max-w-full truncate font-display text-base sm:text-xl">{teamLabel(f.home)}</span>
          </div>
          <span className="scoreboard rounded-xl border-2 border-sun bg-black px-4 py-1 text-4xl text-sun sm:text-5xl">{scoreText(f)}</span>
          <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <Crest clubId={f.away} size={56} />
            <span className="max-w-full truncate font-display text-base sm:text-xl">{teamLabel(f.away)}</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 border-t border-paper/15 pt-3 text-xs">
          <ul className="grid content-start gap-0.5">{scorerLine("home")}</ul>
          <ul className="grid content-start gap-0.5">{scorerLine("away")}</ul>
        </div>
      </Card>
      {d && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
          <div className="grid gap-4">
            <Card title="Match stats">
              <TeamStatBars s={d} />
            </Card>
            {d.userLine && mine && <PostMatchCard line={d.userLine} uid={uid} g={g} fixture={f} mySide={mine} score={[f.result?.hg ?? 0, f.result?.ag ?? 0]} />}
          </div>
          <div className="grid gap-4">
          <Card title="Player ratings">
            <div className="grid gap-4 sm:grid-cols-2">
              {(["home", "away"] as const).map((side) => (
                <div key={side} className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 border-b-2 border-line pb-1 text-xs font-black uppercase tracking-wide">
                    <Crest clubId={side === "home" ? f.home : f.away} size={18} />
                    <span className="truncate">{teamLabel(side === "home" ? f.home : f.away, true)}</span>
                  </div>
                  <ul>
                    {column(side).map(({ p, r }) => (
                      <li key={p.id} className={`flex items-center justify-between gap-2 border-b border-line/10 px-1 py-1 text-sm ${p.isUser ? "rounded-md bg-sun-2 font-bold" : ""}`}>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate">{name(p)}</span>
                          {byGoals(p.id) > 0 && <span title="Goals" className="shrink-0 text-xs">⚽{byGoals(p.id) > 1 ? `×${byGoals(p.id)}` : ""}</span>}
                          {byAssists(p.id) > 0 && <span title="Assists" className="shrink-0 text-xs">🅰{byAssists(p.id) > 1 ? `×${byAssists(p.id)}` : ""}</span>}
                          {f.result?.motm === p.id && <Badge tone="sun">MotM</Badge>}
                        </span>
                        <Rating v={r} size="sm" />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
          <MatchStory g={g} f={f} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function MatchDay() {
  const g = useGameState();
  const live = useGame((s) => s.live);
  const startLive = useGame((s) => s.startLive);
  const finishLive = useGame((s) => s.finishLive);
  const abandonLive = useGame((s) => s.abandonLive);
  const sim = useGame((s) => s.simMatch);
  const askRest = useGame((s) => s.askRest);
  const busy = useGame((s) => s.busy);
  const [lastId, setLastId] = useState<string | null>(null);
  if (!g) return null;

  if (live) {
    return (
      <LiveMatch
        prepared={live.prepared}
        onDone={async () => {
          const id = live.prepared.fixture.id;
          await finishLive();
          abandonLive();
          setLastId(id);
        }}
      />
    );
  }

  const pm = g.pending[0];
  const comp = pm ? g.competitions[pm.compId] : undefined;
  const fixture = comp?.fixtures.find((f) => f.id === pm?.fixtureId);
  const played = userFixtures(g).filter((x) => x.f.result);
  const last = (lastId ? played.find((x) => x.f.id === lastId) : undefined) ?? played[played.length - 1];

  return (
    <div>
      <PageTitle kicker={`${seasonLabel(g.season)} · Week ${g.turn}`} title="Match Day" />
      {fixture && comp ? (
        <Card tone="coral" className="mb-5">
          <div className="text-[11px] font-black uppercase tracking-widest">
            {comp.name}{fixture.stage ? ` · ${fixture.stage}` : ""}{fixture.neutral ? " · neutral venue" : ""}
            {derbyLevel(g, fixture) >= 0.5 && <span className="ml-2 rounded-full border-2 border-line bg-sun px-2 py-0.5 text-ink" data-testid="derby-badge">🔥 Derby</span>}
          </div>
          <MatchContextStrip g={g} fixture={fixture} />
          {(() => {
            const preview = matchPreview(g, fixture, comp);
            return preview ? (
              <Link href={rivalHref(preview.rival.playerId)} className="mx-auto mb-3 block max-w-xl rounded-xl border-2 border-line bg-card p-2.5 text-center text-sm" data-testid="rival-preview">
                <span className="font-black">⚔️ Rivalry · </span>
                {preview.line}
              </Link>
            ) : null;
          })()}
          <FormerManagerBlock g={g} fixture={fixture} />
          <MemoryLane g={g} fixtureId={fixture.id} />
          {(() => {
            const status = matchStatus(g, fixture);
            return (
              <>
                <SelectionBlock g={g} fixture={fixture} status={status} />
                <div className="mt-1 flex flex-wrap justify-center gap-3">
                  {status.actions.playLive && (
                    <Button size="lg" onClick={() => startLive(fixture.id)} data-testid="start-live">▶ {status.actions.liveLabel}</Button>
                  )}
                  {!status.actions.playLive && (
                    <Button size="lg" onClick={() => startLive(fixture.id)} data-testid="start-live">👀 {status.actions.liveLabel}</Button>
                  )}
                  <Button tone="paper" size="lg" disabled={!!busy} onClick={async () => { await sim(fixture.id); setLastId(fixture.id); }} data-testid="sim-match">Quick sim</Button>
                </div>
                {status.actions.rest && canRequestRest(g) && (
                  <div className="mt-4 flex flex-col items-center gap-1 text-center">
                    <Button tone="paper" size="sm" onClick={askRest} data-testid="ask-rest">
                      😮‍💨 Ask to be rested
                    </Button>
                    <span className="text-[11px] text-muted">
                      Fitness {Math.round(user(g).fitness)} · Miss this week&apos;s club games, recover extra.{" "}
                      {user(g).fitness >= 85 ? "The manager won't love it — you look fresh." : "The manager will understand."}
                    </span>
                  </div>
                )}
                <MatchPreviewPanel g={g} fixture={fixture} />
              </>
            );
          })()}
          {g.pending.length > 1 && <p className="mt-3 text-center text-xs">{g.pending.length - 1} more match{g.pending.length > 2 ? "es" : ""} this week.</p>}
        </Card>
      ) : (
        <Card className="mb-5">
          <Empty title="No match for you this week" icon="🗓️">
            Press <b>Continue</b> to move to the next week.
          </Empty>
        </Card>
      )}
      {last && <ResultSummary g={g} f={last.f} />}
    </div>
  );
}
