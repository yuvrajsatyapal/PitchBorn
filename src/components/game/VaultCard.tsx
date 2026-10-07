"use client";
import { Card, LinkButton } from "@/components/ui";
import { currentVault, recallText } from "@/engine/memory/recall";
import type { GameState } from "@/engine/types";

/** "From the vault": this week's recalled memory, if there is one worth showing. */
export function VaultCard({ g }: { g: GameState }) {
  const v = currentVault(g);
  if (!v) return null;
  const t = recallText(g, v);
  if (!t.headline) return null;
  return (
    <Card tone="sun" title="From the vault" action={<LinkButton href="/play/memories" size="sm" tone="paper">Iconic Moments</LinkButton>}>
      <div className="flex items-start gap-3" data-testid="vault">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-line bg-card text-2xl" aria-hidden>{t.icon}</span>
        <div>
          <div className="font-display text-lg">{t.headline}</div>
          <p className="text-sm text-ink-2">{t.body}</p>
        </div>
      </div>
    </Card>
  );
}

/** Pre-match line: why this fixture matters to your story. Only when the recall is about this fixture. */
export function MemoryLane({ g, fixtureId }: { g: GameState; fixtureId: string }) {
  const v = currentVault(g);
  if (!v || v.fixtureId !== fixtureId) return null;
  const t = recallText(g, v);
  if (!t.headline) return null;
  return (
    <div className="mx-auto mb-4 max-w-xl rounded-xl border-2 border-line bg-card/80 p-3 text-center text-ink" data-testid="memory-lane">
      <div className="text-[11px] font-black uppercase tracking-widest text-muted">Memory lane</div>
      <div className="font-display text-lg">{t.icon} {t.headline}</div>
      <p className="text-sm text-ink-2">{t.body}</p>
    </div>
  );
}
