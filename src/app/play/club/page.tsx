"use client";
import { useState } from "react";
import { MobileAdSlot } from "@/ads/AdSlot";
import { Crest } from "@/components/art/Crest";
import { Flag } from "@/components/art/Flag";
import { Kit } from "@/components/art/Kit";
import { PlayerModal } from "@/components/game/PlayerModal";
import { TeamForm } from "@/components/game/widgets";
import { Badge, Bar, Card, Empty, PageTitle, Stat, Table, Tabs } from "@/components/ui";
import { clubName, staticClub, staticLeague, stadium } from "@/engine/data/world";
import { formatMoney } from "@/engine/players/economy";
import type { Player } from "@/engine/types";
import { squadOf } from "@/engine/world/helpers";
import { age, name, ovr, POS_TONE, user } from "@/game/selectors";
import { useGameState } from "@/game/store";

const ORDER = ["GK", "RB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"];

export default function ClubPage() {
  const g = useGameState();
  const [sort, setSort] = useState<"pos" | "ovr" | "age" | "value">("pos");
  const [sel, setSel] = useState<Player | null>(null);
  const p = g ? user(g) : null;
  const squad = g && p?.clubId ? squadOf(g, p.clubId) : [];
  if (!g || !p) return null;
  if (!p.clubId) {
    return (
      <div>
        <PageTitle title="Club" />
        <Empty title="You're between clubs" icon="🧳">
          Clubs can offer you a contract at any time while you&apos;re a free agent. Check Career & Contract.
        </Empty>
      </div>
    );
  }
  const club = g.clubs[p.clubId];
  const st = staticClub(club.id)!;
  const stad = stadium(st.stadiumId);
  const league = staticLeague(club.leagueId);
  const rel = g.user.relationships;
  const sorted = [...squad].sort((a, b) =>
    sort === "ovr" ? ovr(b) - ovr(a) : sort === "age" ? age(g, a) - age(g, b) : sort === "value" ? b.value - a.value : ORDER.indexOf(a.position) - ORDER.indexOf(b.position) || ovr(b) - ovr(a),
  );
  return (
    <div className="grid gap-4">
      <PageTitle kicker={league?.name} title={<span className="flex items-center gap-3"><Crest clubId={club.id} size={48} /> {st.name}</span>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="The club" className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-1">
              <Kit clubId={club.id} size={64} />
              <Kit clubId={club.id} size={64} away />
            </div>
            <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted">Stadium</dt><dd className="font-semibold">{stad?.name}</dd></div>
              <div><dt className="text-xs text-muted">Capacity</dt><dd className="font-semibold">{stad?.capacity.toLocaleString()}</dd></div>
              <div><dt className="text-xs text-muted">City</dt><dd className="font-semibold">{st.city}</dd></div>
              <div><dt className="text-xs text-muted">Founded</dt><dd className="font-semibold">{st.founded ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted">Manager</dt><dd className="flex items-center gap-1 font-semibold"><Flag code={club.manager.nationality} /> {club.manager.name}</dd></div>
              <div><dt className="text-xs text-muted">Formation</dt><dd className="font-semibold">{club.formation}</dd></div>
            </dl>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Reputation" value={Math.round(club.reputation)} />
            <Stat label="Balance" value={formatMoney(club.balance)} />
            <Stat label="Facilities" value={Math.round(club.facilities)} />
            <Stat label="Academy" value={Math.round(club.youth)} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted">Form</span>
            <TeamForm form={club.form} />
          </div>
        </Card>
        <Card title="Relationships">
          <div className="grid gap-3">
            <Bar label="Manager" value={rel.manager} tone="sky" />
            <Bar label="Teammates" value={rel.teammates} tone="pitch" />
            <Bar label="Supporters" value={rel.supporters} tone="sun" />
            <Bar label="Board" value={rel.board} tone="plum" />
          </div>
          <p className="mt-3 text-xs text-muted">Good performances earn the manager&apos;s trust (more starts). Supporters love goals; the board hates transfer requests.</p>
        </Card>
      </div>
      <MobileAdSlot placementId="mobile-inline" />
      <Card title={`Squad (${squad.length})`} action={<Tabs value={sort} onChange={setSort} items={[{ id: "pos", label: "Position" }, { id: "ovr", label: "OVR" }, { id: "age", label: "Age" }, { id: "value", label: "Value" }]} />}>
        <Table>
          <thead>
            <tr>
              <th>Pos</th>
              <th>Player</th>
              <th className="text-right">Age</th>
              <th className="text-right">OVR</th>
              <th className="hidden text-right sm:table-cell">Apps</th>
              <th className="hidden text-right sm:table-cell">G</th>
              <th className="hidden text-right md:table-cell">Value</th>
              <th className="hidden md:table-cell">Role</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((x) => {
              const s = Object.values(x.season).reduce((a, b) => ({ apps: a.apps + b.apps, goals: a.goals + b.goals }), { apps: 0, goals: 0 });
              return (
                <tr key={x.id} className={`cursor-pointer ${x.isUser ? "bg-sun-2 font-bold" : ""}`} onClick={() => setSel(x)}>
                  <td><span className={`rounded-md border-2 border-line px-1 text-xs font-black ${POS_TONE[x.position]}`}>{x.position}</span></td>
                  <td>
                    <span className="flex items-center gap-1.5">
                      <Flag code={x.nationality} /> {name(x)}
                      {x.injury && <Badge tone="coral">inj</Badge>}
                      {club.captain === x.id && <Badge tone="sun">C</Badge>}
                    </span>
                  </td>
                  <td className="text-right">{age(g, x)}</td>
                  <td className="text-right font-bold">{ovr(x)}</td>
                  <td className="hidden text-right sm:table-cell">{s.apps}</td>
                  <td className="hidden text-right sm:table-cell">{s.goals}</td>
                  <td className="hidden text-right md:table-cell">{formatMoney(x.value)}</td>
                  <td className="hidden text-xs md:table-cell">{x.contract?.role}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <PlayerModal g={g} p={sel} onClose={() => setSel(null)} />
      <span className="hidden">{clubName(club.id)}</span>
    </div>
  );
}
