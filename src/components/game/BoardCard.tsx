"use client";
import { Badge, Bar, Button, Card } from "@/components/ui";
import { academyPlayers, boardProgress, managedClub, promoteAcademyPlayer, wageBill, wageCap } from "@/engine/career/board";
import { POSITION_LABEL, overallFor } from "@/engine/players/attributes";
import { formatMoney } from "@/engine/players/economy";
import { ageOf } from "@/engine/players/generate";
import type { GameState } from "@/engine/types";
import { fullName } from "@/engine/world/helpers";
import { useGame } from "@/game/store";

const TONE = { met: "pitch", "on-course": "pitch", "off-course": "coral", missed: "coral", open: "paper" } as const;
const LABEL = { met: "Met", "on-course": "On course", "off-course": "Off course", missed: "Missed", open: "Open" } as const;

/** The board's objectives, the wage cap and the academy pipeline for the club the user manages. */
export function BoardCard({ g }: { g: GameState }) {
  const act = useGame((s) => s.act);
  const club = managedClub(g);
  if (!club) return null;
  const prog = boardProgress(g);
  const bill = wageBill(g, club.id);
  const cap = wageCap(g, club);
  const academy = academyPlayers(g).slice(0, 8);
  return (
    <Card title="🏛️ The board" className="lg:col-span-2" data-testid="board-card">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold">Season objectives</h3>
          {prog.length ? (
            <ul className="grid gap-2">
              {prog.map((p) => (
                <li key={p.objective.id} className="rounded-lg border-2 border-line/20 px-2.5 py-1.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b>{p.objective.label}</b>
                    <Badge tone={TONE[p.state]}>{LABEL[p.state]}</Badge>
                  </div>
                  <div className="text-xs text-ink-2">{p.detail}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">The board sets objectives at the start of the next week.</p>
          )}
          <p className="mt-2 text-[11px] text-muted">Meeting objectives lifts confidence; missing the league target with confidence already low costs you the job at the season&apos;s end.</p>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold">Wages</h3>
          <Bar value={Math.min(bill, cap)} max={cap} label={`${formatMoney(bill)}/wk of ${formatMoney(cap)}/wk`} tone={bill > cap ? "coral" : bill > cap * 0.92 ? "sun" : "pitch"} showValue={false} />
          <p className="mt-1 text-xs text-muted">Signings that would take the bill over the cap are refused.</p>
          <h3 className="mb-2 mt-4 text-sm font-bold">Academy</h3>
          {academy.length ? (
            <ul className="grid gap-1.5">
              {academy.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {fullName(p)} <span className="text-xs text-muted">· {POSITION_LABEL[p.position]} · {ageOf(p, g.season)} · {Math.round(overallFor(p.attrs, p.position))}</span>
                  </span>
                  {p.contract?.youth ? (
                    <Button size="sm" tone="paper" onClick={() => act((gm) => promoteAcademyPlayer(gm, p.id))}>
                      Promote
                    </Button>
                  ) : (
                    <Badge tone="pitch">First team</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">No academy players waiting for a debut. Intake day is in spring.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
