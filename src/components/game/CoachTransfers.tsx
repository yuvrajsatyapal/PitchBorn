"use client";
import { useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Badge, Button, Card, Tabs } from "@/components/ui";
import { bidForPlayer, managerBudget, managerNeeds, managing, marketOpen, reportFor, reportsLeft, salePrice, scoutPlayer, scoutTargets, sellPlayer, toggleListed } from "@/engine/career/coachMarket";
import { overallFor } from "@/engine/players/attributes";
import { formatMoney } from "@/engine/players/economy";
import { ageOf } from "@/engine/players/generate";
import { POSITIONS, type GameState, type Position } from "@/engine/types";
import { fullName, squadOf } from "@/engine/world/helpers";
import { useGame } from "@/game/store";

/** Coaching page, manager only: scout, sign and sell inside the budget and the windows. */
export function CoachTransfers({ g }: { g: GameState }) {
  const act = useGame((s) => s.act);
  const needs = managerNeeds(g);
  const [pos, setPos] = useState<Position>(needs[0] ?? "ST");
  const [tab, setTab] = useState<"market" | "squad">("market");
  const club = managing(g);
  if (!club) return null;
  const open = marketOpen(g);
  const targets = scoutTargets(g, pos);
  const squad = squadOf(g, club.id).sort((a, b) => overallFor(b.attrs, b.position) - overallFor(a.attrs, a.position));
  return (
    <Card title="🔍 Transfers & scouting" className="lg:col-span-2" action={<Badge tone={open ? "pitch" : "paper"}>{open ? "Window open" : "Window closed"}</Badge>}>
      <p className="-mt-2 mb-3 text-xs text-ink-2">
        Budget <b>{formatMoney(managerBudget(g))}</b> · {reportsLeft(g)} scouting report{reportsLeft(g) === 1 ? "" : "s"} left this week{needs.length ? ` · the squad is short at ${needs.slice(0, 3).join(", ")}` : ""}. You scout any time; signing and selling wait for a window.
      </p>
      <Tabs value={tab} onChange={setTab} className="mb-3" items={[{ id: "market", label: "Market" }, { id: "squad", label: `Your squad (${squad.length})` }]} />
      {tab === "market" ? (
        <>
          <div className="mb-2 flex flex-wrap gap-1">
            {POSITIONS.map((p) => (
              <Button key={p} size="sm" tone={p === pos ? "sun" : "paper"} onClick={() => setPos(p)} aria-pressed={p === pos}>{p}{needs.includes(p) ? " •" : ""}</Button>
            ))}
          </div>
          <ul className="grid gap-1.5">
            {targets.map((t) => {
              const rep = t.report;
              return (
                <li key={t.player.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-line/20 px-2.5 py-1.5 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    {t.player.clubId ? <Crest clubId={t.player.clubId} size={20} /> : <Badge>Free</Badge>}
                    <div className="min-w-0">
                      <div className="truncate font-bold">{fullName(t.player)} <span className="text-ink-2">{t.overall} · {t.age}y</span></div>
                      <div className="text-xs text-ink-2">
                        Potential {rep ? <b>{rep.low}–{rep.high}</b> : "?"} · {t.free ? "free agent" : `asking ${formatMoney(t.asking)}`} · {formatMoney(t.wage)}/wk as {t.role}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {!rep && <Button size="sm" tone="paper" disabled={reportsLeft(g) <= 0} onClick={() => act((s) => scoutPlayer(s, t.player.id))}>Scout</Button>}
                    <Button size="sm" tone="pitch" disabled={!open} onClick={() => act((s) => bidForPlayer(s, t.player.id))}>{t.free ? "Sign" : "Bid"}</Button>
                  </div>
                </li>
              );
            })}
            {!targets.length && <li className="text-sm text-ink-2">No one at this level for {pos} right now.</li>}
          </ul>
        </>
      ) : (
        <ul className="grid gap-1.5">
          {squad.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-line/20 px-2.5 py-1.5 text-sm">
              <div className="min-w-0">
                <span className="font-bold">{fullName(p)}</span> <span className="text-ink-2">{p.position} · {Math.round(overallFor(p.attrs, p.position))} · {ageOf(p, g.season)}y</span>
                {reportFor(g, p.id) && <span className="text-xs text-ink-2"> · pot {reportFor(g, p.id)?.low}–{reportFor(g, p.id)?.high}</span>}
                {p.listed && <Badge tone="coral" className="ml-1">Listed</Badge>}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" tone="paper" onClick={() => act((s) => toggleListed(s, p.id))}>{p.listed ? "Unlist" : "List"}</Button>
                <Button size="sm" tone="coral" disabled={!open} onClick={() => act((s) => sellPlayer(s, p.id))}>Sell ~{formatMoney(salePrice(g, p))}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
