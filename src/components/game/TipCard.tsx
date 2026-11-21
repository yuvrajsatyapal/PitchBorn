"use client";
import { Button, LinkButton } from "@/components/ui";
import { activeTip, type TipPage } from "@/engine/career/tips";
import { useGame, useGameState } from "@/game/store";

/** A dismissible first-season tip for one screen. Renders nothing once the season or the tips are over. */
export function TipCard({ page, className = "" }: { page: TipPage; className?: string }) {
  const g = useGameState();
  const dismiss = useGame((s) => s.dismissTip);
  const setTips = useGame((s) => s.setTips);
  if (!g) return null;
  const tip = activeTip(g, page);
  if (!tip) return null;
  return (
    <aside className={`pb-card-flat flex flex-wrap items-start gap-3 bg-sky-2 p-4 ${className}`} role="note" aria-label="Tip" data-testid={`tip-${tip.id}`}>
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-line bg-sky text-xl text-white">💡</span>
      <div className="min-w-[12rem] flex-1">
        <div className="text-[11px] font-black uppercase tracking-wider text-muted">First-season tip</div>
        <div className="font-bold leading-tight">{tip.title}</div>
        <p className="mt-0.5 text-sm text-ink-2">{tip.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {tip.link && (
            <LinkButton href={tip.link.href} size="sm" tone="sky">
              {tip.link.label}
            </LinkButton>
          )}
          <Button size="sm" tone="paper" onClick={() => dismiss(tip.id)} data-testid="tip-dismiss">
            Got it
          </Button>
          <button type="button" className="pb-hit px-2 text-xs font-bold text-muted underline" onClick={() => setTips(false)}>
            Hide all tips
          </button>
        </div>
      </div>
    </aside>
  );
}
