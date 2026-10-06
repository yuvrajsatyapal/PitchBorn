"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSuppressAds } from "@/ads/AdContext";
import { Crest } from "@/components/art/Crest";
import { Badge, Button, Card, Rating } from "@/components/ui";
import type { MatchEvent } from "@/engine/match/engine";
import type { PreparedMatch } from "@/engine/season/matchday";
import { teamLabel } from "@/game/selectors";
import { useGame } from "@/game/store";

const SPEEDS = [
  { id: 0, label: "❚❚", ms: 0 },
  { id: 1, label: "1×", ms: 650 },
  { id: 2, label: "3×", ms: 220 },
  { id: 3, label: "10×", ms: 60 },
];

const ICON: Partial<Record<MatchEvent["type"], string>> = {
  goal: "⚽", save: "🧤", miss: "↗", woodwork: "🥅", blocked: "🛡", yellow: "🟨", red: "🟥", injury: "🩹", sub: "🔁", halftime: "⏸", fulltime: "🏁", penalty: "🎯", decision: "⭐", tackle: "💪", extratime: "⏱", shootout: "🎯", kickoff: "🟢", info: "•", foul: "✋",
};

export function LiveMatch({ prepared, onDone }: { prepared: PreparedMatch; onDone: () => void }) {
  useSuppressAds(true);
  const eng = prepared.engine;
  const [, force] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [flash, setFlash] = useState(false);
  const feedRef = useRef<HTMLOListElement>(null);
  const uid = useGame((s) => s.game?.user.playerId);
  const tick = useCallback(() => {
    if (eng.finished || eng.pending) return;
    const evs = eng.step();
    if (evs.some((e) => e.type === "goal")) {
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
    }
    force((x) => x + 1);
  }, [eng]);

  useEffect(() => {
    const ms = SPEEDS[speed].ms;
    if (!ms || eng.finished || eng.pending) return;
    const t = setInterval(tick, ms);
    return () => clearInterval(t);
  }, [speed, tick, eng.finished, eng.pending]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  });

  const [h, a] = eng.score;
  const stats = eng.liveStats;
  const userLine = uid ? eng.lineFor(uid) : undefined;
  const onPitch = uid ? eng.isOnPitch(uid) : false;
  const events = [...eng.events].reverse();
  const home = eng.input.home;
  const away = eng.input.away;
  const minute = Math.min(eng.minute, 120);

  return (
    <div className="grid gap-4">
      <Card className="bg-ink text-paper" flat>
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

      {eng.pending && (
        <Card tone="sun" className="anim-pop border-[3px]">
          <div className="text-[11px] font-black uppercase tracking-widest">Key moment · {eng.pending.minute}&apos;</div>
          <p className="my-2 font-display text-2xl leading-tight">{eng.pending.prompt}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {eng.pending.options.map((o) => (
              <button
                key={o.id}
                className="pb-btn flex-col items-start bg-card px-4 py-2 text-left"
                onClick={() => {
                  eng.resolve(o.id);
                  force((x) => x + 1);
                }}
                data-testid="decision-option"
              >
                <span>{o.label}</span>
                <span className="text-xs font-normal text-ink-2">
                  {o.detail} · <b>{o.odds >= 0.65 ? "Good odds" : o.odds >= 0.4 ? "Even odds" : "Risky"}</b>
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title="Commentary" action={
          <div className="flex gap-1" role="group" aria-label="Match speed">
            {SPEEDS.map((s) => (
              <button key={s.id} onClick={() => setSpeed(s.id)} aria-pressed={speed === s.id} className={`rounded-full border-2 border-line px-2.5 py-1 text-xs font-bold ${speed === s.id ? "bg-ink text-paper" : "bg-card"}`}>
                {s.label}
              </button>
            ))}
          </div>
        }>
          <ol ref={feedRef} className="grid max-h-[420px] gap-1.5 overflow-y-auto pr-1" aria-live="polite">
            {events.map((e, i) => (
              <li key={events.length - i} className={`anim-slide flex gap-2 rounded-lg px-2 py-1.5 text-sm ${e.type === "goal" ? "border-2 border-line bg-pitch-2 font-bold" : e.user ? "bg-sun-2" : ""}`}>
                <span className="scoreboard w-8 shrink-0 text-xs text-muted">{e.minute}&apos;</span>
                <span aria-hidden>{ICON[e.type] ?? "•"}</span>
                <span>{e.text}</span>
              </li>
            ))}
          </ol>
        </Card>
        <div className="grid content-start gap-4">
          <Card title="You">
            {prepared.userSide ? (
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{prepared.userStarting ? "Starting XI" : onPitch ? "On from the bench" : userLine ? "Substituted" : "On the bench"}</span>
                  <Rating v={userLine?.rating} />
                </div>
                {userLine && (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="pitch">⚽ {userLine.goals}</Badge>
                    <Badge tone="sky">🅰 {userLine.assists}</Badge>
                    <Badge>Shots {userLine.shots}</Badge>
                    <Badge>Key passes {userLine.keyPasses}</Badge>
                    <Badge>Tackles {userLine.tackles}</Badge>
                    {userLine.saves > 0 && <Badge>Saves {userLine.saves}</Badge>}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-2">You weren&apos;t selected for this match. Watch your teammates.</p>
            )}
          </Card>
          <Card title="Stats">
            {(
              [
                ["Possession", stats.possession, "%"],
                ["Shots", stats.shots, ""],
                ["On target", stats.onTarget, ""],
                ["xG", stats.xg, ""],
                ["Corners", stats.corners, ""],
                ["Fouls", stats.fouls, ""],
                ["Cards", [stats.yellows[0] + stats.reds[0], stats.yellows[1] + stats.reds[1]], ""],
              ] as [string, [number, number], string][]
            ).map(([label, [x, y], unit]) => (
              <div key={label} className="mb-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="tabular-nums">{x}{unit}</span>
                  <span className="text-muted">{label}</span>
                  <span className="tabular-nums">{y}{unit}</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full border-2 border-line">
                  <div className="bg-pitch" style={{ width: `${(x / Math.max(0.01, x + y)) * 100}%` }} />
                  <div className="flex-1 bg-coral" />
                </div>
              </div>
            ))}
          </Card>
          <div className="flex flex-wrap gap-2">
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
      </div>
    </div>
  );
}
