"use client";
import Link from "next/link";
import { useState } from "react";
import { InlineAdSlot } from "@/ads/AdSlot";
import { Crest } from "@/components/art/Crest";
import { LiveMatch } from "@/components/game/LiveMatch";
import { rivalHref } from "@/components/game/RivalCards";
import { MemoryLane } from "@/components/game/VaultCard";
import { matchPreview } from "@/engine/career/rivalry/engine";
import { rivalryLevel } from "@/engine/memory/rivalry";
import { Badge, Button, Card, Empty, PageTitle, Rating, Table } from "@/components/ui";
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

function ResultSummary({ g, f }: { g: GameState; f: Fixture }) {
  const comp = g.competitions[f.compId];
  const d = f.result?.detail;
  const ratings = d ? Object.entries(d.ratings).map(([id, r]) => ({ p: g.players[id], r })).filter((x) => x.p).sort((a, b) => b.r - a.r) : [];
  const goals = f.result?.goals ?? [];
  return (
    <div className="grid gap-4">
      <Card className="!bg-[#1b1712] !text-[#fff5e6]" flat>
        <div className="text-center text-xs font-bold uppercase tracking-widest text-sun/80">
          {comp?.name} {f.stage ? `· ${f.stage}` : ""} · Full time
        </div>
        <div className="mt-2 flex items-center justify-center gap-4">
          <Crest clubId={f.home} size={50} />
          <span className="scoreboard rounded-xl border-2 border-sun bg-black px-4 py-1 text-4xl text-sun">{scoreText(f)}</span>
          <Crest clubId={f.away} size={50} />
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span>{teamLabel(f.home)}</span>
          <span>{teamLabel(f.away)}</span>
        </div>
        <ul className="mt-3 grid gap-0.5 text-xs">
          {goals.map((gl, i) => (
            <li key={i} className={gl.side === "home" ? "text-left" : "text-right"}>
              ⚽ {g.players[gl.scorer]?.squadNo !== undefined && comp?.kind !== "international" && comp?.kind !== "friendly" ? `#${g.players[gl.scorer].squadNo} ` : ""}{g.players[gl.scorer] ? name(g.players[gl.scorer]) : "—"} {gl.minute}&apos;{gl.penalty ? " (pen)" : ""}
              {gl.assist && g.players[gl.assist] ? <span className="opacity-70"> · assist {g.players[gl.assist].lastName}</span> : null}
            </li>
          ))}
        </ul>
      </Card>
      {d && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Match stats">
            {(
              [
                ["Possession", d.possession],
                ["Shots", d.shots],
                ["On target", d.onTarget],
                ["xG", d.xg],
                ["Corners", d.corners],
                ["Fouls", d.fouls],
              ] as [string, [number, number]][]
            ).map(([l, [x, y]]) => (
              <div key={l} className="flex justify-between border-b border-line/10 py-1 text-sm">
                <span className="tabular-nums font-bold">{x}</span>
                <span className="text-muted">{l}</span>
                <span className="tabular-nums font-bold">{y}</span>
              </div>
            ))}
          </Card>
          <Card title="Player ratings">
            <Table>
              <tbody>
                {ratings.slice(0, 16).map(({ p, r }) => (
                  <tr key={p.id} className={p.isUser ? "bg-sun-2 font-bold" : ""}>
                    <td>
                      <span className="flex items-center gap-2">
                        <Crest clubId={p.clubId} size={16} /> {name(p)} {f.result?.motm === p.id && <Badge tone="sun">MotM</Badge>}
                      </span>
                    </td>
                    <td className="text-right">
                      <Rating v={r} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}
      <InlineAdSlot placementId="after-result" />
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
          <div className="my-4 flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-1"><Crest clubId={fixture.home} size={70} /><b>{teamLabel(fixture.home)}</b></div>
            <span className="scoreboard text-3xl">VS</span>
            <div className="flex flex-col items-center gap-1"><Crest clubId={fixture.away} size={70} /><b>{teamLabel(fixture.away)}</b></div>
          </div>
          {(() => {
            const preview = matchPreview(g, fixture, comp);
            return preview ? (
              <Link href={rivalHref(preview.rival.playerId)} className="mx-auto mb-3 block max-w-xl rounded-xl border-2 border-line bg-card p-2.5 text-center text-sm" data-testid="rival-preview">
                <span className="font-black">⚔️ Rivalry · </span>
                {preview.line}
              </Link>
            ) : null;
          })()}
          <MatchContextStrip g={g} fixture={fixture} />
          <FormerManagerBlock g={g} fixture={fixture} />
          <MemoryLane g={g} fixtureId={fixture.id} />
          {(() => {
            const status = matchStatus(g, fixture);
            return (
              <>
                <SelectionBlock g={g} fixture={fixture} status={status} />
                <div className="flex flex-wrap justify-center gap-2">
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
