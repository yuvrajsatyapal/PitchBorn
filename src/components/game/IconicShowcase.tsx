"use client";
import { Card, LinkButton } from "@/components/ui";
import { describeMemory } from "@/engine/memory/describe";
import { memoriesByImportance } from "@/engine/memory/store";
import type { GameState, Memory } from "@/engine/types";

const ENDINGS = ["retirement", "final-match"];

/** The career's highlight reel: the biggest moments in the order they happened. */
export function topMoments(g: GameState, limit: number): Memory[] {
  return memoriesByImportance(g)
    .filter((m) => !ENDINGS.includes(m.kind))
    .slice(0, limit)
    .sort((a, b) => a.season - b.season || a.turn - b.turn);
}

export function IconicShowcase({ g, limit = 5, final = false, title = "Iconic Moments" }: { g: GameState; limit?: number; final?: boolean; title?: string }) {
  const moments = topMoments(g, limit);
  if (!moments.length) return null;
  const ending = final ? g.user.memories.find((m) => m.kind === "final-match") : undefined;
  return (
    <Card title={title} tone="sun" action={<LinkButton href="/play/memories" size="sm" tone="paper">All moments</LinkButton>}>
      <ol className="grid gap-2" data-testid="iconic-showcase">
        {moments.map((m) => {
          const v = describeMemory(g, m);
          return (
            <li key={m.id} className="flex items-center gap-3 rounded-xl border-2 border-line bg-card p-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-line bg-sun-2 text-xl" aria-hidden>{v.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg leading-tight">{v.title}</span>
                <span className="block truncate text-xs text-ink-2">{v.line}</span>
              </span>
              <span className="shrink-0 rounded-full border-2 border-line bg-paper-2 px-2 py-0.5 text-xs font-bold">{v.ageLabel}</span>
            </li>
          );
        })}
        {ending && (
          <li className="flex items-center gap-3 rounded-xl border-2 border-line bg-ink p-2.5 text-paper">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-paper/40 text-xl" aria-hidden>🔔</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg leading-tight">The final match</span>
              <span className="block truncate text-xs opacity-80">{describeMemory(g, ending).line}</span>
            </span>
            <span className="shrink-0 rounded-full border-2 border-paper/40 px-2 py-0.5 text-xs font-bold">Age {ending.age}</span>
          </li>
        )}
      </ol>
    </Card>
  );
}
