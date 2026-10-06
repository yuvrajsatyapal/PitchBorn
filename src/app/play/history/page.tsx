"use client";
import { InlineAdSlot } from "@/ads/AdSlot";
import { Flag } from "@/components/art/Flag";
import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { seasonLabel } from "@/engine/calendar";
import type { TimelineKind } from "@/engine/types";
import { name, ovr } from "@/game/selectors";
import { useGameState } from "@/game/store";

const ICON: Record<TimelineKind, string> = {
  start: "🌱", debut: "👟", "first-goal": "⚽", milestone: "⭐", transfer: "✈️", loan: "🔄", contract: "✍️", trophy: "🏆", award: "🥇",
  international: "🌍", injury: "🩹", breakthrough: "🚀", record: "📈", retirement: "🏛️", event: "•", promotion: "⬆️", relegation: "⬇️",
};

export default function History() {
  const g = useGameState();
  if (!g) return null;
  const tl = g.user.timeline;
  const bySeason = new Map<number, typeof tl>();
  for (const e of tl) bySeason.set(e.season, [...(bySeason.get(e.season) ?? []), e]);
  const seasons = [...bySeason.keys()].sort((a, b) => b - a);
  const allTime = [
    ...Object.values(g.players).filter((p) => !p.virtual).map((p) => ({ id: p.id, name: name(p), nat: p.nationality, goals: p.career.goals, apps: p.career.apps, caps: p.intl.caps, active: true, user: !!p.isUser, peak: ovr(p) })),
    ...g.legends.map((l) => ({ id: l.id, name: l.name, nat: l.nationality, goals: l.goals, apps: l.apps, caps: l.caps, active: false, user: false, peak: l.peak })),
  ];
  const topScorers = [...allTime].sort((a, b) => b.goals - a.goals).slice(0, 10);
  return (
    <div className="grid gap-4">
      <PageTitle kicker="Your story so far" title="Career History" />
      <Card title="Timeline">
        {seasons.length ? (
          <ol className="relative grid gap-5 border-l-[3px] border-line pl-5">
            {seasons.map((s, si) => (
              <li key={s}>
                <div className="absolute -left-[11px] mt-1 h-5 w-5 rounded-full border-[3px] border-line bg-sun" aria-hidden />
                <div className="font-display text-2xl">{seasonLabel(s)}</div>
                <ul className="mt-1 grid gap-1.5">
                  {bySeason.get(s)!.map((e, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span aria-hidden>{ICON[e.kind]}</span>
                      <span>
                        <b>{e.title}</b>
                        {e.detail && <span className="text-ink-2"> — {e.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                {si === 1 && <InlineAdSlot placementId="history-break" className="mt-4" />}
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="Your story begins now" icon="📜" />
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="World records">
          {g.records.length ? (
            <ul className="grid gap-2 text-sm">
              {g.records.map((r) => (
                <li key={r.id} className={`flex items-center justify-between rounded-xl border-2 px-3 py-2 ${r.playerId === g.user.playerId ? "border-line bg-sun-2" : "border-line/20"}`}>
                  <span>
                    <span className="block text-xs text-muted">{r.label}</span>
                    <b>{r.name}</b>
                  </span>
                  <span className="scoreboard text-xl">{r.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Records are tallied at the end of each season.</p>
          )}
        </Card>
        <Card title="All-time top scorers (Pitchborn era)">
          <Table>
            <tbody>
              {topScorers.map((x, i) => (
                <tr key={x.id} className={x.user ? "bg-sun-2 font-bold" : ""}>
                  <td className="w-6">{i + 1}</td>
                  <td><span className="flex items-center gap-1.5"><Flag code={x.nat} /> {x.name} {!x.active && <span className="text-xs text-muted">(retired)</span>}</span></td>
                  <td className="text-right text-xs">{x.apps} apps</td>
                  <td className="text-right font-black">{x.goals}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-muted">Career totals for fictional players include goals before 2026.</p>
        </Card>
      </div>
    </div>
  );
}
