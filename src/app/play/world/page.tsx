"use client";
import { useState } from "react";
import { InlineAdSlot } from "@/ads/AdSlot";
import { Crest } from "@/components/art/Crest";
import { Badge, Card, Empty, PageTitle, Table, Tabs } from "@/components/ui";
import { formatTurnDate } from "@/engine/calendar";
import { clubName } from "@/engine/data/world";
import { formatMoney } from "@/engine/players/economy";
import type { NewsKind } from "@/engine/types";
import { useGameState } from "@/game/store";

const KIND_TONE: Partial<Record<NewsKind, "sun" | "pitch" | "plum" | "coral" | "sky">> = { transfer: "sky", award: "sun", injury: "coral", national: "pitch", career: "plum", memory: "sun" };

export default function World() {
  const g = useGameState();
  const [view, setView] = useState<"news" | "transfers">("news");
  const [kind, setKind] = useState<"all" | NewsKind>("all");
  if (!g) return null;
  const news = g.news.filter((n) => kind === "all" || n.kind === kind);
  const transfers = [...g.transferLog].reverse().filter((t) => t.fee > 0).slice(0, 60);
  return (
    <div className="grid gap-4">
      <PageTitle kicker="Around the game" title="World News" className="-mb-1" />
      <Tabs value={view} onChange={setView} items={[{ id: "news", label: "News feed" }, { id: "transfers", label: "Transfer log" }]} />
      {view === "news" ? (
        <>
          <Tabs value={kind} onChange={setKind} items={(["all", "match", "transfer", "award", "career", "national", "world", "injury", "event"] as const).map((k) => ({ id: k, label: k[0].toUpperCase() + k.slice(1) }))} />
          <Card>
            {news.length ? (
              <ul className="grid gap-2">
                {news.slice(0, 80).map((n, i) => (
                  <li key={n.id}>
                    <div className={`rounded-xl border-2 px-3 py-2 ${n.important ? "border-line bg-sun-2" : "border-line/20"}`}>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <Badge tone={KIND_TONE[n.kind]}>{n.kind}</Badge> {formatTurnDate(n.season, n.turn)}
                      </div>
                      <div className="mt-1 font-semibold">{n.title}</div>
                      {n.body && <div className="text-sm text-ink-2">{n.body}</div>}
                    </div>
                    {i === 9 && <InlineAdSlot placementId="feed-break" className="mt-2" />}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No news" icon="📰" />
            )}
          </Card>
        </>
      ) : (
        <Card title="Big-money moves this season">
          {transfers.length ? (
            <Table>
              <thead><tr><th>Player</th><th>From</th><th>To</th><th className="text-right">Fee</th></tr></thead>
              <tbody>
                {transfers.map((t, i) => (
                  <tr key={i} className={t.playerId === g.user.playerId ? "bg-sun-2 font-bold" : ""}>
                    <td>{t.name}</td>
                    <td><span className="flex items-center gap-1.5"><Crest clubId={t.from} size={16} /> {clubName(t.from, true)}</span></td>
                    <td><span className="flex items-center gap-1.5"><Crest clubId={t.to} size={16} /> {clubName(t.to, true)}</span></td>
                    <td className="text-right font-bold">{formatMoney(t.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty title="No transfers yet" icon="💸">Deals happen in the summer and January windows.</Empty>
          )}
        </Card>
      )}
    </div>
  );
}
