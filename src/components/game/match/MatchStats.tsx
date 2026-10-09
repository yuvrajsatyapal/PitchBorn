"use client";
import { useState } from "react";
import { Card, Rating, Tabs } from "@/components/ui";
import type { MatchEngine } from "@/engine/match/engine";
import { minutesOf, ratingVisible, statCells } from "@/engine/match/insight";

type View = "match" | "you";

function Row({ label, x, y, unit = "" }: { label: string; x: number; y: number; unit?: string }) {
  const none = x + y <= 0;
  const left = none ? 50 : (x / (x + y)) * 100;
  return (
    <div className="mb-2.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className={`tabular-nums ${x > y ? "font-black" : "font-semibold text-ink-2"}`}>{x}{unit}</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
        <span className={`tabular-nums ${y > x ? "font-black" : "font-semibold text-ink-2"}`}>{y}{unit}</span>
      </div>
      <div className="mt-0.5 flex h-2 overflow-hidden rounded-full border-2 border-line bg-paper-2">
        <div className={none ? "bg-line/30" : "bg-pitch"} style={{ width: `${left}%` }} />
        {!none && <div className="flex-1 bg-coral" />}
      </div>
    </div>
  );
}

export function TeamStatBars({ s }: { s: { possession: [number, number]; shots: [number, number]; onTarget: [number, number]; xg: [number, number]; corners: [number, number]; fouls: [number, number]; yellows: [number, number]; reds: [number, number]; passes?: [number, number]; passesOk?: [number, number] } }) {
  const acc = (ok: number, n: number) => (n ? Math.round((ok / n) * 100) : 0);
  return (
    <>
      <Row label="Possession" x={s.possession[0]} y={s.possession[1]} unit="%" />
      <Row label="Shots" x={s.shots[0]} y={s.shots[1]} />
      <Row label="On target" x={s.onTarget[0]} y={s.onTarget[1]} />
      <Row label="xG" x={s.xg[0]} y={s.xg[1]} />
      {s.passes && s.passesOk && (
        <>
          <Row label="Passes" x={s.passes[0]} y={s.passes[1]} />
          <Row label="Pass accuracy" x={acc(s.passesOk[0], s.passes[0])} y={acc(s.passesOk[1], s.passes[1])} unit="%" />
        </>
      )}
      <Row label="Corners" x={s.corners[0]} y={s.corners[1]} />
      <Row label="Fouls" x={s.fouls[0]} y={s.fouls[1]} />
      <Row label="Cards" x={s.yellows[0] + s.reds[0]} y={s.yellows[1] + s.reds[1]} />
    </>
  );
}

/** The match's team numbers, or the user's own: the figures his position makes meaningful. */
export function MatchStats({ eng, uid, canShowYou }: { eng: MatchEngine; uid: string | undefined; canShowYou: boolean }) {
  const [view, setView] = useState<View>("match");
  const s = eng.liveStats;
  const line = uid ? eng.lineFor(uid) : undefined;
  const played = !!line && line.minuteOn >= 0;
  const showYou = view === "you" && canShowYou;
  const cells = showYou && line && played ? statCells(line, eng.minute, true) : [];
  return (
    <Card title="Stats" action={canShowYou ? <Tabs<View> value={view} onChange={setView} items={[{ id: "match", label: "Match" }, { id: "you", label: "You" }]} className="!pb-0" /> : undefined}>
      {!showYou ? (
        <div>
          <TeamStatBars s={s} />
        </div>
      ) : !line || !played ? (
        <p className="text-sm text-ink-2">Your numbers appear once you&apos;re on the pitch.</p>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{minutesOf(line, eng.minute)} minutes · {line.slot}</span>
            <Rating v={ratingVisible(line, eng.minute, eng.finished) ? line.rating : undefined} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4">
            {cells.map((c) => (
              <div key={c.label} className="flex items-baseline justify-between border-b border-line/10 py-1 text-sm">
                <dt className="text-muted">{c.label}</dt>
                <dd className="num">{c.value}{c.sub && <span className="ml-1 text-[10px] text-ink-2">{c.sub}</span>}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Card>
  );
}
