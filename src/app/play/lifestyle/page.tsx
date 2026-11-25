"use client";
import { Badge, Button, Card, PageTitle, Stat } from "@/components/ui";
import {
  buyItem, canBuy, cashOut, INVESTMENTS, invest, investAmounts, LIFESTYLE, lifestyleEffects, netWorth, ownedItems, priceLevel, quote, sellItem, weeklyUpkeep,
  type LifestyleEffects, type LifestyleKind,
} from "@/engine/career/lifestyle";
import { formatMoney } from "@/engine/players/economy";
import { useGame, useGameState } from "@/game/store";

const GROUPS: { kind: LifestyleKind; title: string; note: string }[] = [
  { kind: "home", title: "🏠 Home", note: "One at a time. A better home means fuller recovery between games." },
  { kind: "car", title: "🚘 Car", note: "One at a time. Flash cars lift your commercial appeal; the board notices." },
  { kind: "staff", title: "🧑‍⚕️ Personal staff", note: "Weekly wages only. Hire any combination." },
  { kind: "charity", title: "💛 Charity", note: "Supporters warm to it, your reputation grows each season, and it counts towards your legacy." },
];

function effectText(fx: LifestyleEffects): string {
  const parts: string[] = [];
  if (fx.recovery) parts.push(`+${fx.recovery} fitness/wk`);
  if (fx.injury && fx.injury < 1) parts.push(`${Math.round((1 - fx.injury) * 100)}% fewer training injuries`);
  if (fx.morale) parts.push(`+${fx.morale.toFixed(2)} morale/wk`);
  if (fx.supporters) parts.push(`fans +${fx.supporters}/wk`);
  if (fx.appeal) parts.push(`+${fx.appeal} commercial appeal`);
  if (fx.reputation) parts.push(`+${fx.reputation} reputation/season`);
  if (fx.board) parts.push(`board ${fx.board}/wk`);
  return parts.join(" · ");
}

export default function Lifestyle() {
  const g = useGameState();
  const act = useGame((s) => s.act);
  if (!g) return null;
  const owned = new Set(ownedItems(g).map((i) => i.id));
  const fx = lifestyleEffects(g);
  const upkeep = weeklyUpkeep(g);
  const holdings = g.user.lifestyle?.investments ?? [];
  const level = priceLevel(g);
  const amounts = investAmounts(g);
  const bought = new Map((g.user.lifestyle?.owned ?? []).map((o) => [o.id, o]));
  return (
    <div className="grid gap-4">
      <PageTitle kicker="Off the pitch" title="Lifestyle & Money" className="-mb-1" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Bank" value={formatMoney(g.user.bank)} tone="pitch" />
        <Stat label="Net worth" value={formatMoney(netWorth(g))} />
        <Stat label="Upkeep" value={`${formatMoney(upkeep)}/wk`} tone={upkeep ? "sun" : undefined} />
        <Stat label="Given to charity" value={formatMoney(g.user.lifestyle?.donated ?? 0)} />
      </div>
      {level < 1 && <p className="text-sm text-ink-2">Prices follow what you earn: on your wages you pay about <b>{Math.round(level * 100)}%</b> of what a top earner would. Whatever you buy keeps the price and upkeep you agreed.</p>}
      {owned.size > 0 && <p className="text-sm text-ink-2">Right now your lifestyle gives you: <b>{effectText(fx) || "nothing measurable"}</b>.</p>}
      {GROUPS.map((grp) => (
        <Card key={grp.kind} title={grp.title}>
          <p className="-mt-2 mb-3 text-xs text-ink-2">{grp.note}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {LIFESTYLE.filter((i) => i.kind === grp.kind).map((i) => {
              const mine = owned.has(i.id);
              const check = canBuy(g, i.id);
              const held = bought.get(i.id);
              const cost = mine ? { price: held?.price ?? i.price, upkeep: held?.upkeep ?? i.upkeep } : quote(g, i.id);
              return (
                <li key={i.id} className={`flex flex-col rounded-xl border-2 p-3 ${mine ? "border-pitch bg-pitch-2/20" : "border-line"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold"><span aria-hidden>{i.icon}</span> {i.name}</div>
                    {mine && <Badge tone="pitch">Yours</Badge>}
                  </div>
                  <div className="text-xs text-ink-2">{i.blurb}</div>
                  <div className="mt-1 text-xs">{effectText(i.effects)}</div>
                  <div className="mt-1 text-xs text-muted">{mine ? "Paid " : ""}{cost.price ? `${formatMoney(cost.price)} · ` : ""}{formatMoney(cost.upkeep)}/wk</div>
                  <div className="mt-auto pt-2">
                    {mine ? (
                      <Button size="sm" tone="paper" onClick={() => act((s) => sellItem(s, i.id))}>{i.kind === "home" || i.kind === "car" ? "Sell (70%)" : "Stop"}</Button>
                    ) : (
                      <>
                        <Button size="sm" tone="sun" disabled={!check.ok} onClick={() => act((s) => buyItem(s, i.id))}>{i.kind === "staff" ? "Hire" : i.kind === "charity" ? "Launch" : "Buy"}</Button>
                        {!check.ok && <span className="ml-2 text-[11px] text-muted">{check.reason}</span>}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      <Card title="📈 Investments">
        <p className="-mt-2 mb-3 text-xs text-ink-2">Money put in settles at the end of each full season it has been held. Cashing out early can cost a fee.</p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {INVESTMENTS.map((d) => (
            <li key={d.id} className="rounded-xl border-2 border-line p-3">
              <div className="font-bold"><span aria-hidden>{d.icon}</span> {d.name}</div>
              <div className="text-xs text-ink-2">{d.blurb}{d.exitFee ? ` Early exit fee ${Math.round(d.exitFee * 100)}%.` : ""}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {amounts.map((a) => (
                  <Button key={a} size="sm" tone="paper" disabled={g.user.bank < a} onClick={() => act((s) => invest(s, d.id, a))}>{formatMoney(a)}</Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        {holdings.length > 0 && (
          <ul className="mt-3 grid gap-1.5">
            {holdings.map((h) => {
              const d = INVESTMENTS.find((x) => x.id === h.kind);
              const up = h.value >= h.amount;
              return (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-line/20 px-2.5 py-1.5 text-sm">
                  <span>{d?.icon} {d?.name} · in {formatMoney(h.amount)} · now <b className={up ? "text-pitch" : "text-coral"}>{formatMoney(h.value)}</b></span>
                  <Button size="sm" tone="paper" onClick={() => act((s) => cashOut(s, h.id))}>Cash out</Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
