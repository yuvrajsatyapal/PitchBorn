"use client";
import { Badge, Button, Card } from "@/components/ui";
import { askForDuty, dutyStatus, SET_PIECE_LABEL, setPieceRecord } from "@/engine/career/setPieces";
import type { GameState, SetPieceKind } from "@/engine/types";
import { useGame } from "@/game/store";

const KINDS: SetPieceKind[] = ["penalty", "freekick"];

/** Club page: who takes the penalties and free kicks, asking for the duty, and the record from dead balls. */
export function SetPieceCard({ g }: { g: GameState }) {
  const act = useGame((s) => s.act);
  const p = g.players[g.user.playerId];
  if (!p?.clubId || p.position === "GK") return null;
  const rec = setPieceRecord(g);
  return (
    <Card title="Set pieces" className="h-full" data-testid="set-pieces">
      <ul className="grid gap-2">
        {KINDS.map((k) => {
          const d = dutyStatus(g, k);
          const label = SET_PIECE_LABEL[k];
          return (
            <li key={k} className="rounded-lg border-2 border-line/20 px-2.5 py-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold">{label.many}</div>
                  <div className="text-xs text-ink-2">
                    {d.mine ? (d.granted ? "Yours: the manager handed you the duty." : "Yours: you're the best taker in the side.") : `${d.current?.name ?? "A teammate"} takes them.`}
                  </div>
                </div>
                {d.mine ? (
                  <Badge tone="pitch">Your duty</Badge>
                ) : (
                  <Button size="sm" tone="sun" className="shrink-0 whitespace-nowrap" disabled={!d.canAsk} onClick={() => act((s) => askForDuty(s, k), `You're the new ${label.duty}.`)}>
                    Ask for it
                  </Button>
                )}
              </div>
              {!d.mine && !d.canAsk && d.reason && <div className="mt-1 text-[11px] text-muted">{d.reason}</div>}
              {!d.mine && d.canAsk && <div className="mt-1 text-[11px] text-muted">{d.likely ? "The manager would probably agree." : `Long shot: work on ${k === "penalty" ? "finishing and composure" : "long shots and technique"}.`}</div>}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-2">
        Penalties: <b>{rec.pensScored}/{rec.pens}</b> · Free kicks: <b>{rec.fksScored}/{rec.fks}</b>. In live matches you choose how to take your own kicks. Miss two of your last three penalties and the manager gives them to someone else.
      </p>
    </Card>
  );
}
