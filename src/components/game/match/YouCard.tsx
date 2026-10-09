"use client";
import { useState } from "react";
import { ShirtNo } from "@/components/game/NumberPicker";
import { Badge, Bar, Card, Rating } from "@/components/ui";
import type { MatchEngine } from "@/engine/match/engine";
import { instruction, lowInvolvementReason, minutesOf, performance, ratingReasons, ratingVisible, statCells, type Tone } from "@/engine/match/insight";

const TONE: Record<Tone, "pitch" | "paper" | "coral"> = { good: "pitch", neutral: "paper", bad: "coral" };

/** The user's player in the match: where he is, how it's going, what the manager wants, and why. */
export function YouCard({ eng, uid, squadNo, userInSquad, fitness }: { eng: MatchEngine; uid: string | undefined; squadNo: number | undefined; userInSquad: boolean; fitness: number | undefined }) {
  const [open, setOpen] = useState(false);
  if (!userInSquad || !uid) {
    return (
      <Card title="You">
        <p className="text-sm text-ink-2" data-testid="you-state">Not in the squad. You weren&apos;t selected for this match: watch your teammates.</p>
      </Card>
    );
  }
  const state = eng.playerState(uid);
  const line = eng.lineFor(uid);
  const minute = Math.min(eng.minute, 120);
  const ctx = eng.userContext();
  const no = squadNo !== undefined ? <ShirtNo no={squadNo} size="sm" /> : null;

  if (state.phase === "bench" || state.phase === "warming" || state.phase === "unused" || state.phase === "none") {
    const warming = state.phase === "warming";
    return (
      <Card title="You" className={warming ? "!bg-sun-2" : ""}>
        <div className="flex items-center gap-2 text-sm font-bold" data-testid="you-state">
          {no}
          <span className="uppercase tracking-wide">{state.phase === "unused" ? "Unused substitute" : warming ? "Warming up" : "On the bench"}</span>
        </div>
        <p className="mt-1.5 text-sm text-ink-2">
          {state.phase === "unused" ? "You didn't get on tonight." : warming ? "The manager may bring you on." : "Waiting for your opportunity."}
        </p>
        {fitness !== undefined && state.phase !== "unused" && (
          <div className="mt-3">
            <Bar value={fitness} label="Fitness" tone="pitch" height={8} />
          </div>
        )}
      </Card>
    );
  }
  if (!line) return null;

  const playing = state.phase === "playing";
  const full = state.phase === "fulltime";
  const off = state.phase === "off";
  const visible = ratingVisible(line, eng.minute, eng.finished);
  const trend = ctx?.ratingTrend;
  const perf = performance(line, eng.minute, ctx);
  const why = lowInvolvementReason(line, eng.minute, ctx);
  const task = playing || full ? instruction(line, eng.minute, ctx) : undefined;
  const cells = statCells(line, eng.minute);
  const reasons = visible ? ratingReasons(line) : { good: [], bad: [] };
  const energy = eng.energyOf(uid);
  const mins = minutesOf(line, eng.minute);
  const headline =
    state.phase === "off"
      ? `OFF ${state.minuteOff}'`
      : state.phase === "fulltime"
        ? "FULL TIME"
        : state.phase === "playing"
          ? state.started
            ? `PLAYING · ${minute}'`
            : `ON ${state.minuteOn}'`
          : "";
  const offWhy = off ? (state.reason === "red" ? "Sent off" : state.reason === "injury" ? "Injured" : "Substituted") : undefined;

  return (
    <Card title="You">
      <div className="grid gap-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-bold" data-testid="you-state">
              {no}
              <span className="scoreboard text-xs">{line.slot}</span>
              <span className="uppercase tracking-wide">{headline}</span>
            </div>
            {offWhy && <div className="mt-0.5 text-xs text-ink-2">{offWhy}</div>}
          </div>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Why this rating?" disabled={!visible} className="flex items-center gap-1.5 disabled:cursor-default" data-testid="rating-btn">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Rating</span>
            <Rating v={visible ? line.rating : undefined} />
            {visible && trend !== undefined && playing && Math.abs(trend) >= 0.2 && (
              <span className={`text-sm font-black ${trend > 0 ? "text-pitch" : "text-coral"}`} aria-label={trend > 0 ? "rising" : "falling"}>{trend > 0 ? "↑" : "↓"}</span>
            )}
          </button>
        </div>

        {open && visible && (
          <div className="rounded-xl border-2 border-line bg-paper-2 p-2.5 text-xs" data-testid="rating-why">
            {reasons.good.length + reasons.bad.length === 0 ? (
              <p className="text-ink-2">Nothing has moved your rating much yet.</p>
            ) : (
              <div className="grid gap-1.5">
                {reasons.good.map((r) => (
                  <div key={r.text} className="flex gap-1.5"><b className="text-pitch">+</b>{r.text}</div>
                ))}
                {reasons.bad.map((r) => (
                  <div key={r.text} className="flex gap-1.5"><b className="text-coral">−</b>{r.text}</div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] text-muted">The final rating also reflects the result and how your side did as a whole.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={TONE[perf.tone]}>{perf.label}</Badge>
          <Badge>{mins}&apos; played</Badge>
          {energy !== undefined && playing && <Badge>Energy {energy}%</Badge>}
        </div>

        {why && playing && <p className="text-xs text-ink-2" data-testid="involvement-why">{why}</p>}

        {task && (
          <div className="rounded-xl border-2 border-line bg-sun-2 px-3 py-2" data-testid="instruction">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted">Manager&apos;s instruction</div>
            <div className="font-display text-base leading-tight">{task.title}</div>
            <div className="text-xs text-ink-2">{task.detail}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs font-bold">
              <span>{task.progress}</span>
              {task.score >= 1 && <span className="text-pitch">✓ Done</span>}
            </div>
          </div>
        )}

        <dl className="grid grid-cols-3 gap-1.5" data-testid="you-stats">
          {cells.map((c) => (
            <div key={c.label} className="rounded-lg border-2 border-line bg-card px-2 py-1">
              <dt className="truncate text-[10px] font-bold uppercase tracking-wide text-muted">{c.short ?? c.label}</dt>
              <dd className="num text-base leading-tight">
                {c.value}
                {c.sub && <span className="ml-1 text-[10px] font-semibold text-ink-2">{c.sub}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}
