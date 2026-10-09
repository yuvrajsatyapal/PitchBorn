"use client";
import { useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Badge } from "@/components/ui";
import { resultNote, type Bracket as BracketData, type Tie } from "@/engine/competitions/bracket";
import { fixtureWinner } from "@/engine/competitions/setup";
import type { Fixture } from "@/engine/types";
import { teamLabel } from "@/game/selectors";

const COL_W = 176;
const GAP = 36;
const UNIT = 38;
const CARD_H = 62;

/** One side of a tie: crest, name, goals and, after a shoot-out, the penalties. */
function Side({ f, side, mine }: { f: Fixture; side: "home" | "away"; mine: boolean }) {
  const id = side === "home" ? f.home : f.away;
  const r = f.result;
  const winner = fixtureWinner(f);
  const goals = r ? (side === "home" ? r.hg : r.ag) : null;
  const pen = r?.pens ? (side === "home" ? r.pens[0] : r.pens[1]) : null;
  const won = winner === id;
  return (
    <div className={`flex items-center gap-1.5 px-1.5 py-[3px] ${mine ? "bg-sun-2" : ""} ${winner && !won ? "text-muted" : ""}`}>
      <Crest clubId={id} size={16} />
      <span className={`min-w-0 flex-1 truncate text-[12px] ${won ? "font-black" : ""}`}>{teamLabel(id, true)}</span>
      <span className="scoreboard w-5 text-right text-[12px] tabular-nums">{goals ?? ""}</span>
      {pen !== null && <span className="w-5 text-right text-[11px] font-bold text-muted tabular-nums">({pen})</span>}
    </div>
  );
}

export function TieCard({ tie, highlight, compact }: { tie: Tie; highlight: string[]; compact?: boolean }) {
  const f = tie.fixture;
  const note = resultNote(f, (id) => teamLabel(id, true));
  const mine = (id: string) => highlight.includes(id);
  return (
    <div className={`overflow-hidden rounded-lg border-2 ${highlight.includes(f.home) || highlight.includes(f.away) ? "border-line" : "border-line/40"} bg-card`} data-testid="tie" aria-label={`${teamLabel(f.home, true)} versus ${teamLabel(f.away, true)}${f.result ? `, ${note.text ?? "full time"}` : ", to be played"}`}>
      <Side f={f} side="home" mine={mine(f.home)} />
      <div className="border-t border-line/15" />
      <Side f={f} side="away" mine={mine(f.away)} />
      {!compact && note.text && <div className="border-t border-line/15 bg-paper-2/60 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">{note.text}</div>}
    </div>
  );
}

/** The connected knockout bracket: rounds as columns, lines from each tie to the one its winner played next. */
export function BracketView({ bracket, highlight }: { bracket: BracketData; highlight: string[] }) {
  const rounds = bracket.rounds;
  // Positions: real ties carry their own; empty (not yet drawn) rounds sit between the pair that will feed them.
  const ys: number[][] = rounds.map((r) => r.ties.map((t) => t.y));
  for (let i = 0; i < rounds.length; i++) {
    if (!rounds[i].pending) continue;
    const prev = ys[i - 1] ?? [];
    ys[i] = Array.from({ length: Math.max(1, Math.ceil(prev.length / 2)) }, (_, k) => {
      const pair = prev.slice(k * 2, k * 2 + 2);
      return pair.reduce((a, b) => a + b, 0) / Math.max(1, pair.length);
    });
  }
  const maxY = Math.max(...ys.flat(), 1);
  const height = (maxY + 1) * UNIT;
  const width = rounds.length * COL_W + (rounds.length - 1) * GAP;
  const colX = (i: number) => i * (COL_W + GAP);
  const lines: { d: string; mine: boolean; key: string }[] = [];
  rounds.forEach((r, i) => {
    if (i === 0) return;
    r.ties.forEach((t, k) => {
      for (const feeder of t.from) {
        if (!feeder) continue;
        const x1 = colX(i - 1) + COL_W;
        const x2 = colX(i);
        const mid = x1 + GAP / 2;
        const mine = highlight.includes(feeder.winner ?? "");
        lines.push({ key: `${i}-${k}-${feeder.fixture.id}`, d: `M${x1},${feeder.y * UNIT} H${mid} V${t.y * UNIT} H${x2}`, mine });
      }
    });
    if (r.pending) {
      ys[i].forEach((y, k) => {
        for (const py of ys[i - 1].slice(k * 2, k * 2 + 2)) {
          const x1 = colX(i - 1) + COL_W;
          lines.push({ key: `p${i}-${k}-${py}`, d: `M${x1},${py * UNIT} H${x1 + GAP / 2} V${y * UNIT} H${colX(i)}`, mine: false });
        }
      });
    }
  });
  return (
    <div className="no-scrollbar overflow-x-auto pb-2" data-testid="bracket">
      <div className="relative" style={{ width, height: height + 24, minWidth: width }}>
        {rounds.map((r, i) => (
          <div key={r.round + r.stage} className="absolute top-0 text-[11px] font-black uppercase tracking-wider text-muted" style={{ left: colX(i), width: COL_W }}>
            {r.stage}
          </div>
        ))}
        <svg className="absolute left-0 top-6" width={width} height={height} aria-hidden>
          {lines.map((l) => (
            <path key={l.key} d={l.d} fill="none" stroke={l.mine ? "var(--sky)" : "var(--line)"} strokeOpacity={l.mine ? 1 : 0.45} strokeWidth={l.mine ? 2.5 : 1.5} />
          ))}
        </svg>
        {rounds.map((r, i) =>
          r.pending
            ? ys[i].map((y, k) => (
                <div key={`p${i}-${k}`} className="absolute flex items-center justify-center rounded-lg border-2 border-dashed border-line/30 text-[11px] text-muted" style={{ left: colX(i), top: 24 + y * UNIT - CARD_H / 2, width: COL_W, height: CARD_H }}>
                  {r.stage === "Final" ? "🏆 Final" : "To be decided"}
                </div>
              ))
            : r.ties.map((t) => (
                <div key={t.fixture.id} className="absolute" style={{ left: colX(i), top: 24 + t.y * UNIT - CARD_H / 2, width: COL_W }}>
                  <TieCard tie={t} highlight={highlight} compact />
                </div>
              )),
        )}
      </div>
    </div>
  );
}

/** A collapsible list of ties, rendered only when open (a 46-tie round costs nothing until it is asked for). */
export function RoundList({ title, fixtures, highlight, defaultOpen = false, onlyMine = false }: { title: string; fixtures: Fixture[]; highlight: string[]; defaultOpen?: boolean; onlyMine?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const list = onlyMine ? fixtures.filter((f) => highlight.includes(f.home) || highlight.includes(f.away)) : fixtures;
  const mineHere = fixtures.some((f) => highlight.includes(f.home) || highlight.includes(f.away));
  return (
    <div className="rounded-xl border-2 border-line/25">
      <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="font-bold">{title}</span>
        <span className="flex items-center gap-2 text-xs text-muted">
          {mineHere && <Badge tone="sun">Your club</Badge>}
          {list.length} {list.length === 1 ? "tie" : "ties"} <span aria-hidden>{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && (
        <ul className="grid gap-1.5 px-2 pb-2 sm:grid-cols-2" data-testid="round-list">
          {list.map((f) => {
            const note = resultNote(f, (id) => teamLabel(id, true));
            return (
              <li key={f.id} className={`rounded-lg border-2 px-2 py-1 text-sm ${highlight.includes(f.home) || highlight.includes(f.away) ? "border-line bg-sun-2" : "border-line/15"}`}>
                <div className="flex items-center gap-2">
                  <Crest clubId={f.home} size={16} />
                  <span className={`min-w-0 flex-1 truncate ${fixtureWinner(f) === f.home ? "font-bold" : ""}`}>{teamLabel(f.home, true)}</span>
                  <span className="scoreboard text-xs">{f.result ? `${f.result.hg}–${f.result.ag}` : "v"}</span>
                  <span className={`min-w-0 flex-1 truncate text-right ${fixtureWinner(f) === f.away ? "font-bold" : ""}`}>{teamLabel(f.away, true)}</span>
                  <Crest clubId={f.away} size={16} />
                </div>
                {note.text && <div className="text-[11px] text-ink-2">{note.text}</div>}
              </li>
            );
          })}
          {!list.length && <li className="text-xs text-muted">Your club has no tie in this round.</li>}
        </ul>
      )}
    </div>
  );
}
