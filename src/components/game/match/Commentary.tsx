"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Tabs } from "@/components/ui";
import type { MatchEvent } from "@/engine/match/engine";
import { filterEvents, isYou, type FeedFilter } from "@/engine/match/feed";

const ICON: Partial<Record<MatchEvent["type"], string>> = {
  goal: "⚽", save: "🧤", miss: "↗", woodwork: "🥅", blocked: "🛡", yellow: "🟨", red: "🟥", injury: "🩹", sub: "🔁", halftime: "⏸", fulltime: "🏁", penalty: "🎯", decision: "⭐", tackle: "💪", extratime: "⏱", shootout: "🎯", kickoff: "🟢", info: "•", foul: "✋",
};

const SPEEDS = [
  { id: 0, label: "❚❚", name: "Pause" },
  { id: 1, label: "1×", name: "Normal speed" },
  { id: 2, label: "3×", name: "3 times speed" },
  { id: 3, label: "10×", name: "10 times speed" },
];

export function SpeedControl({ speed, setSpeed, paused }: { speed: number; setSpeed: (n: number) => void; paused: boolean }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Match speed">
      {paused && <span className="mr-1 text-[10px] font-black uppercase tracking-wider text-coral">Your call</span>}
      {SPEEDS.map((s) => (
        <button key={s.id} onClick={() => setSpeed(s.id)} aria-pressed={speed === s.id} aria-label={s.name} className={`min-h-[34px] min-w-[38px] rounded-full border-2 border-line px-2.5 py-1 text-xs font-bold ${speed === s.id ? "bg-ink text-paper" : "bg-card"}`}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

/** The one event stream, as everything, as the user's own involvement, or as only the moments that matter. */
export function Commentary({ events, uid, clubGame, shirt, speedControl, className = "" }: {
  events: readonly MatchEvent[];
  uid: string | undefined;
  clubGame: boolean;
  shirt: (id: string) => number | undefined;
  speedControl: React.ReactNode;
  className?: string;
}) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const feedRef = useRef<HTMLOListElement>(null);
  const count = events.length;
  // Newest first. Rebuilt only when an event arrives or the filter changes, not on every render.
  const shown = useMemo(() => filterEvents(events, filter, uid).reverse(), [events, count, filter, uid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [count, filter]);
  return (
    <Card className={`${className} lg:absolute lg:inset-0 lg:flex lg:flex-col`} title="Commentary">
      <div className="mb-2 flex justify-end">{speedControl}</div>
      <Tabs<FeedFilter> value={filter} onChange={setFilter} className="mb-2" items={[{ id: "all", label: "All" }, { id: "you", label: "You" }, { id: "key", label: "Key" }]} />
      <ol ref={feedRef} className="grid max-h-[420px] content-start gap-1.5 overflow-y-auto pr-1 lg:max-h-none lg:min-h-0 lg:flex-1" aria-live="polite" data-testid="feed">
        {shown.length === 0 && <li className="px-2 py-3 text-sm text-ink-2">{filter === "you" ? "Nothing yet. Your involvement shows up here." : "Nothing yet."}</li>}
        {shown.map((e, i) => {
          const mine = isYou(e, uid);
          const goal = e.type === "goal";
          const status = e.tag === "status";
          const no = goal && e.playerId && clubGame ? shirt(e.playerId) : undefined;
          return (
            <li
              key={count - i}
              data-kind={e.type}
              data-you={mine ? "1" : undefined}
              className={`anim-slide flex gap-2 rounded-lg px-2 py-1.5 text-sm ${goal ? "border-2 border-line bg-pitch-2 font-bold" : mine ? "border-l-4 border-sun bg-sun-2" : ""} ${status ? "italic" : ""}`}
            >
              <span className="scoreboard w-8 shrink-0 text-xs text-muted">{e.minute}&apos;</span>
              <span aria-hidden>{status ? "💬" : ICON[e.type] ?? "•"}</span>
              <span>
                {mine && (goal || !/^you/i.test(e.text)) && <b className="mr-1 text-[11px] tracking-wide">{goal ? "★ YOU —" : "YOU —"}</b>}
                {no !== undefined ? <b className="mr-1 tabular-nums">#{no}</b> : null}
                {e.text}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
