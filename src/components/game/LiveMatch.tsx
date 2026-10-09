"use client";
import { useCallback, useEffect, useState } from "react";
import { useSuppressAds } from "@/ads/AdContext";
import { Crest } from "@/components/art/Crest";
import { Commentary, SpeedControl } from "@/components/game/match/Commentary";
import { DecisionCard } from "@/components/game/match/DecisionCard";
import { MatchStats } from "@/components/game/match/MatchStats";
import { tickInterval } from "@/components/game/match/speed";
import { PostMatchCard } from "@/components/game/match/PostMatchCard";
import { YouCard } from "@/components/game/match/YouCard";
import { Button, Card, Tabs } from "@/components/ui";
import type { PreparedMatch } from "@/engine/season/matchday";
import { teamLabel } from "@/game/selectors";
import { useGame } from "@/game/store";

type Pane = "commentary" | "stats";

export function LiveMatch({ prepared, onDone }: { prepared: PreparedMatch; onDone: () => void }) {
  useSuppressAds(true);
  const eng = prepared.engine;
  const [, force] = useState(0);
  // The speed the user chose. A key moment pauses play without touching it, so the match carries on at the same pace afterwards.
  const [speed, setSpeed] = useState(1);
  const [flash, setFlash] = useState(false);
  const [pane, setPane] = useState<Pane>("commentary");
  const game = useGame((s) => s.game);
  const uid = game?.user.playerId;
  const me = uid ? game?.players[uid] : undefined;
  const players = game?.players;
  const compKind = game?.competitions[prepared.fixture.compId]?.kind;
  const clubGame = compKind !== "international" && compKind !== "friendly";

  const tick = useCallback(() => {
    if (eng.finished || eng.pending) return;
    const evs = eng.step();
    if (evs.some((e) => e.type === "goal")) {
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
    }
    force((x) => x + 1);
  }, [eng]);

  const paused = !!eng.pending;
  useEffect(() => {
    const ms = tickInterval(speed, eng.finished, paused);
    if (!ms) return;
    const t = setInterval(tick, ms);
    return () => clearInterval(t);
  }, [speed, tick, eng.finished, paused]);

  const [h, a] = eng.score;
  const home = eng.input.home;
  const away = eng.input.away;
  const minute = Math.min(eng.minute, 120);
  const shirt = useCallback((id: string) => players?.[id]?.squadNo, [players]);

  return (
    <div className="grid gap-4">
      <Card className="!bg-[#1b1712] !text-[#fff5e6]" flat>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Crest clubId={home.id} size={44} />
            <span className="truncate font-display text-lg sm:text-2xl">{teamLabel(home.id, true)}</span>
          </div>
          <div className={`text-center ${flash ? "anim-goal" : ""}`}>
            <div className="scoreboard rounded-xl border-2 border-sun bg-black px-4 py-1 text-4xl text-sun sm:text-5xl" aria-live="polite" data-testid="score">
              {h}-{a}
            </div>
            <div className="scoreboard mt-1 text-xs text-sun/80">{eng.finished ? "FT" : `${minute}'`}</div>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <span className="truncate text-right font-display text-lg sm:text-2xl">{teamLabel(away.id, true)}</span>
            <Crest clubId={away.id} size={44} />
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper/20">
          <div className="h-full bg-sun transition-all" style={{ width: `${Math.min(100, (minute / 90) * 100)}%` }} />
        </div>
      </Card>

      <DecisionCard
        eng={eng}
        onResolve={(id) => {
          eng.resolve(id);
          force((x) => x + 1);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="lg:col-start-2 lg:row-start-1">
          <YouCard eng={eng} uid={uid} squadNo={me?.squadNo} userInSquad={!!prepared.userSide} fitness={me ? Math.round(me.fitness) : undefined} />
        </div>
        <div className="grid gap-4 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:grid-rows-[1fr] lg:self-stretch">
          <Tabs<Pane> value={pane} onChange={setPane} className="lg:hidden" items={[{ id: "commentary", label: "Commentary" }, { id: "stats", label: "Stats" }]} />
          <div className={`lg:relative lg:min-h-[480px] ${pane === "commentary" ? "" : "hidden lg:block"}`}>
            <Commentary
              events={eng.events}
              uid={uid}
              clubGame={clubGame}
              shirt={shirt}
              speedControl={<SpeedControl speed={speed} setSpeed={setSpeed} paused={paused} />}
            />
          </div>
          <div className={`lg:hidden ${pane === "stats" ? "" : "hidden"}`}>
            <MatchStats eng={eng} uid={uid} canShowYou={!!prepared.userSide} />
          </div>
        </div>
        <div className="hidden lg:col-start-2 lg:row-start-2 lg:block">
          <MatchStats eng={eng} uid={uid} canShowYou={!!prepared.userSide} />
        </div>
        <div className="flex flex-wrap gap-2 lg:col-start-2 lg:row-start-3">
          {!eng.finished ? (
            <Button
              tone="paper"
              onClick={() => {
                eng.runToEnd();
                force((x) => x + 1);
              }}
            >
              Skip to full time ⏭
            </Button>
          ) : (
            <Button tone="pitch" size="lg" onClick={onDone} data-testid="finish-match">
              Finish match ▸
            </Button>
          )}
        </div>
      </div>

      {eng.finished && game && uid && prepared.userSide && <PostMatchCard line={eng.lineFor(uid)} uid={uid} g={game} fixture={prepared.fixture} mySide={prepared.userSide} score={eng.score} />}
    </div>
  );
}
