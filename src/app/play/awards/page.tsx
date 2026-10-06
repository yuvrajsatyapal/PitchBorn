"use client";
import { MobileAdSlot } from "@/ads/AdSlot";
import { Crest } from "@/components/art/Crest";
import { Badge, Card, Empty, PageTitle, Table } from "@/components/ui";
import { seasonLabel } from "@/engine/calendar";
import { clubName, countryName } from "@/engine/data/world";
import { user } from "@/game/selectors";
import { useGameState } from "@/game/store";

export default function Awards() {
  const g = useGameState();
  if (!g) return null;
  const p = user(g);
  const ua = g.user.awards;
  const totw = ua.filter((a) => a.id === "totw").length;
  const majors = ua.filter((a) => a.id !== "totw");
  const counts = new Map<string, number>();
  for (const a of majors) counts.set(a.name, (counts.get(a.name) ?? 0) + 1);
  const worldWinners = g.archive.flatMap((a) => a.awards.filter((x) => x.id === "golden-pitch" || x.id === "rising-star").map((x) => ({ ...x })));
  return (
    <div className="grid gap-4">
      <PageTitle kicker="Silverware" title="Trophies & Awards" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Trophy cabinet (${g.user.trophies.length})`} tone="sun">
          {g.user.trophies.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.user.trophies.map((t, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl border-2 border-line bg-card p-2 text-sm">
                  <span className="text-2xl" aria-hidden>🏆</span>
                  <span>
                    <b>{t.name}</b>
                    <span className="block text-xs text-muted">{seasonLabel(t.season)} · {t.clubId ? clubName(t.clubId, true) : countryName(t.country)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="The cabinet is empty — for now" icon="🏆" />
          )}
        </Card>
        <Card title="Individual honours">
          <div className="mb-3 flex flex-wrap gap-2">
            {[...counts.entries()].map(([n, c]) => (
              <Badge key={n} tone="plum">{c}× {n}</Badge>
            ))}
            {totw > 0 && <Badge tone="sky">{totw}× Team of the Week</Badge>}
          </div>
          {majors.length ? (
            <ul className="grid gap-1 text-sm">
              {[...majors].reverse().map((a, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-muted">{seasonLabel(a.season)}</span>
                  <b>{a.name}</b> <span className="text-xs text-ink-2">{a.scope}{a.value ? ` · ${a.value}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Win Player of the Month, Golden Boots and more by performing consistently.</p>
          )}
        </Card>
      </div>
      <MobileAdSlot placementId="mobile-inline" />
      <Card title="World honours roll">
        {worldWinners.length ? (
          <Table>
            <thead><tr><th>Season</th><th>Award</th><th>Winner</th><th>Club</th></tr></thead>
            <tbody>
              {[...worldWinners].reverse().map((w, i) => (
                <tr key={i} className={w.playerId === p.id ? "bg-sun-2 font-bold" : ""}>
                  <td>{seasonLabel(w.season)}</td>
                  <td>{w.name}</td>
                  <td>{g.players[w.playerId] ? `${g.players[w.playerId].firstName} ${g.players[w.playerId].lastName}` : g.legends.find((l) => l.id === w.playerId)?.name ?? "Retired player"}</td>
                  <td><span className="flex items-center gap-1.5"><Crest clubId={w.clubId ?? null} size={16} /> {clubName(w.clubId ?? null, true)}</span></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-muted">The Golden Pitch and Rising Star awards are presented each summer.</p>
        )}
      </Card>
    </div>
  );
}
