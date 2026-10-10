"use client";
import { useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Badge, Card, Modal } from "@/components/ui";
import { clubName } from "@/engine/data/world";
import { describeMemory } from "@/engine/memory/describe";
import { rivalsOf } from "@/engine/memory/rivalry";
import type { GameState } from "@/engine/types";

/** What each label means, strongest first, so "Bad blood" is never a guess. */
const LABEL_HINTS: { label: string; tone: "coral" | "sun"; hint: string }[] = [
  { label: "Derby", tone: "coral", hint: "Two clubs from the same city, like Manchester United and Manchester City, Real Madrid and Atlético, or Sevilla and Betis. Bragging rights for a whole city." },
  { label: "Fierce rivalry", tone: "coral", hint: "One of the biggest fixtures in the club's calendar, between clubs from different cities. Supporters on both sides live for it." },
  { label: "Heated rivalry", tone: "sun", hint: "A long-standing feud. These games carry extra tension and the crowd makes it known." },
  { label: "Rivalry", tone: "sun", hint: "A real but lower-key edge between the two clubs. The games still run hot." },
  { label: "Bad blood", tone: "sun", hint: "A smaller grudge, often one your own career stoked with a late winner, a bitter exit or a heated moment." },
];

/** Rivals of the club you play for, and what your own career has made of them. */
export function RivalryCard({ g, clubId }: { g: GameState; clubId: string }) {
  const rivals = rivalsOf(g, clubId);
  const [open, setOpen] = useState(false);
  if (!rivals.length) return null;
  return (
    <Card
      title="Rivalries"
      action={
        <button type="button" onClick={() => setOpen(true)} className="pb-hit text-xs font-bold text-muted underline-offset-2 hover:underline">
          What do these mean?
        </button>
      }
    >
      <ul className="grid gap-2">
        {rivals.map((r) => {
          const mine = g.user.memories.filter((m) => m.opponentId === r.clubId).sort((a, b) => b.importance - a.importance);
          const best = mine[0];
          return (
            <li key={r.clubId} className="flex items-center gap-3 rounded-xl border-2 border-line bg-card p-2.5">
              <Crest clubId={r.clubId} size={34} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-bold">{clubName(r.clubId, true)} <Badge tone={r.level >= 0.85 ? "coral" : "sun"}>{r.label}</Badge></span>
                <span className="block text-xs text-ink-2">
                  {best ? `Your best against them: ${describeMemory(g, best).title} (${describeMemory(g, best).seasonLabel})` : "You have yet to leave your mark on this fixture."}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <Modal open={open} onClose={() => setOpen(false)} title="What rivalries mean">
        <p className="mb-3 text-sm text-ink-2">Rivalries show which clubs matter most to the supporters, and what your own career has made of them.</p>
        <ul className="grid gap-3">
          {LABEL_HINTS.map((l) => (
            <li key={l.label} className="grid gap-1 text-sm">
              <span><Badge tone={l.tone}>{l.label}</Badge></span>
              <span className="text-ink-2">{l.hint}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </Card>
  );
}
