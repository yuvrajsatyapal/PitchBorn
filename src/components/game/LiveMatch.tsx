"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { MatchEvent } from "@/engine/match/engine";
import { cardSting, finalWhistleCrowd, goalSting, nearMiss, onSoundChange, startCrowd, stopCrowd, whistle } from "@/audio/sound";
import { SoundToggle } from "@/components/game/SoundToggle";
import { cosmeticDef } from "@/engine/career/goals";
import { teamLabel } from "@/game/selectors";
import { useGame } from "@/game/store";
import { ConditionsChip } from "@/components/game/Conditions";

type Pane = "commentary" | "stats";

/** The sounds for a batch of match events. */
function playEvents(evs: MatchEvent[], userSide: "home" | "away" | null, clubs?: { home: string; away: string }) {
  for (const e of evs) {
    if (e.type === "kickoff") whistle("short");
    else if (e.type === "halftime" || e.type === "extratime") whistle("long");
    else if (e.type === "fulltime") {
      whistle("triple");
      if (userSide && e.score) {
        const [mine, theirs] = userSide === "home" ? e.score : [e.score[1], e.score[0]];
        setTimeout(() => finalWhistleCrowd(mine > theirs ? "win" : mine === theirs ? "draw" : "loss"), 1600);
      }
    } else if (e.type === "goal") goalSting(!userSide || e.side === userSide, clubs && e.side ? clubs[e.side] : undefined);
    else if (e.type === "woodwork" || (e.type === "save" && e.big) || (e.type === "miss" && e.big)) nearMiss();
    else if (e.type === "yellow" || e.type === "red") cardSting(e.type === "red");
    else if (e.type === "foul" || e.type === "penalty") whistle("short");
  }
}

export function LiveMatch({ prepared, onDone }: { prepared: PreparedMatch; onDone: () => void }) {
  useSuppressAds(true);
  const eng = prepared.engine;
  const [, force] = useState(0);
  // The speed the user chose. A key moment pauses play without touching it, so the match carries on at the same pace afterwards.
  const [speed, setSpeed] = useState(1);
  const [flash, setFlash] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [pane, setPane] = useState<Pane>("commentary");
  const game = useGame((s) => s.game);
  const uid = game?.user.playerId;
  const me = uid ? game?.players[uid] : undefined;
  const players = game?.players;
  const compKind = game?.competitions[prepared.fixture.compId]?.kind;
  const clubGame = compKind !== "international" && compKind !== "friendly";
  const celebration = cosmeticDef(game?.user.cosmetics?.equipped.celebration);
  // Club chants only (national teams have anthems, not terrace songs); neutral venues have no home end.
  const fx = prepared.fixture;
  const chantClubs = useMemo(() => (clubGame ? { home: fx.home, away: fx.away } : undefined), [clubGame, fx.home, fx.away]);
  const crowdOpts = { away: prepared.userSide === "away" && !fx.neutral, homeClub: chantClubs && !fx.neutral ? fx.home : undefined, awayClub: chantClubs?.away };
  const crowdKey = JSON.stringify(crowdOpts);

  const tick = useCallback(() => {
    if (eng.finished || eng.pending) return;
    const evs = eng.step();
    playEvents(evs, prepared.userSide, chantClubs);
    if (evs.some((e) => e.type === "goal")) {
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
    }
    if (celebration && evs.some((e) => e.type === "goal" && e.playerId === uid)) {
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 2600);
    }
    force((x) => x + 1);
  }, [eng, prepared.userSide, chantClubs, celebration, uid]);

  // Crowd noise for as long as the match screen is open (when sound is on).
  useEffect(() => {
    const opts = JSON.parse(crowdKey);
    startCrowd(0.25, opts);
    if (eng.minute === 0) whistle("short");
    const off = onSoundChange((on) => (on ? startCrowd(0.25, opts) : stopCrowd()));
    return () => {
      off();
      stopCrowd();
    };
  }, [eng, crowdKey]);

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

  const matchAction = (compact: boolean) => !eng.finished ? (
    <Button
      tone="paper"
      size={compact ? "sm" : "md"}
      className={compact ? "shrink-0 whitespace-nowrap !px-3 !text-xs" : ""}
      onClick={() => {
        eng.runToEnd();
        force((x) => x + 1);
      }}
    >
      Skip to full time ⏭
    </Button>
  ) : (
    <Button tone="pitch" size={compact ? "sm" : "lg"} className={compact ? "shrink-0 whitespace-nowrap !px-3 !text-xs" : ""} onClick={onDone} data-testid="finish-match">
      Finish match ▸
    </Button>
  );

  return (
    <div className="grid gap-4">
      <Card className="!bg-[#1b1712] !text-[#fff5e6]" flat>
        {celebrating && celebration && (
          <div role="status" className="anim-pop mb-2 rounded-xl border-2 border-sun bg-sun px-3 py-1.5 text-center font-bold text-[#1b1712]">
            <span aria-hidden>{celebration.icon}</span> You {celebration.line}!
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Crest clubId={home.id} size={44} />
            <span className="truncate font-display text-lg sm:text-2xl">{teamLabel(home.id, true)}</span>
          </div>
          <div className={`shrink-0 text-center ${flash ? "anim-goal" : ""}`}>
            <div className="scoreboard whitespace-nowrap rounded-xl border-2 border-sun bg-black px-3 py-1 text-3xl text-sun sm:px-4 sm:text-5xl" aria-live="polite" data-testid="score">
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
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {eng.input.conditions && <ConditionsChip c={eng.input.conditions} />}
          <SoundToggle />
        </div>
      </Card>

      <DecisionCard
        eng={eng}
        onResolve={(id) => {
          playEvents(eng.resolve(id), prepared.userSide, chantClubs);
          force((x) => x + 1);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="lg:col-start-2 lg:row-start-1">
          <YouCard eng={eng} uid={uid} squadNo={me?.squadNo} userInSquad={!!prepared.userSide} fitness={me ? Math.round(me.fitness) : undefined} />
        </div>
        <div className="grid gap-4 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:grid-rows-[1fr] lg:self-stretch">
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <Tabs<Pane> value={pane} onChange={setPane} className="min-w-0" items={[{ id: "commentary", label: "Commentary" }, { id: "stats", label: "Stats" }]} />
            {matchAction(true)}
          </div>
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
        <div className="hidden flex-wrap gap-2 lg:col-start-2 lg:row-start-3 lg:flex">
          {matchAction(false)}
        </div>
      </div>

      {eng.finished && game && uid && prepared.userSide && <PostMatchCard line={eng.lineFor(uid)} uid={uid} g={game} fixture={prepared.fixture} mySide={prepared.userSide} score={eng.score} />}
    </div>
  );
}
