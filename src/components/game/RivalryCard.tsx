"use client";
import { Crest } from "@/components/art/Crest";
import { Badge, Card } from "@/components/ui";
import { clubName } from "@/engine/data/world";
import { describeMemory } from "@/engine/memory/describe";
import { rivalsOf } from "@/engine/memory/rivalry";
import type { GameState } from "@/engine/types";

/** Rivals of the club you play for, and what your own career has made of them. */
export function RivalryCard({ g, clubId }: { g: GameState; clubId: string }) {
  const rivals = rivalsOf(g, clubId);
  if (!rivals.length) return null;
  return (
    <Card title="Rivalries">
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
    </Card>
  );
}
