"use client";
import { useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Flag } from "@/components/art/Flag";
import { RunBadge } from "@/components/game/CompetitionRun";
import { PlayerModal } from "@/components/game/PlayerModal";
import { TeamForm } from "@/components/game/widgets";
import { Badge, Card, Empty, PageTitle, Stat, Table } from "@/components/ui";
import { country } from "@/engine/data/world";
import type { Player } from "@/engine/types";
import { age, name, ovr, POS_TONE, scoreText, teamLabel, user } from "@/game/selectors";
import { useGameState } from "@/game/store";
import { IntlNumberCard } from "@/components/game/NumberPicker";
import { AllegianceCard } from "@/components/game/AllegianceCard";
import { intlTeam } from "@/engine/national/identity";

export default function National() {
  const g = useGameState();
  const [sel, setSel] = useState<Player | null>(null);
  if (!g) return null;
  const p = user(g);
  const code = intlTeam(p);
  const nt = g.nationalTeams[code];
  const ntCoach = country(code)?.manager?.name === nt?.manager ? country(code)?.manager : undefined;
  const squad = (nt?.squad ?? []).map((id) => g.players[id]).filter(Boolean).sort((a, b) => ovr(b) - ovr(a));
  const inSquad = nt?.squad.includes(p.id);
  const fixtures = Object.values(g.competitions)
    .filter((c) => c.kind === "international")
    .flatMap((c) => c.fixtures.filter((f) => f.home === code || f.away === code).map((f) => ({ c, f })))
    .sort((a, b) => a.f.turn - b.f.turn);
  const rank = [...Object.values(g.nationalTeams)].sort((a, b) => b.strength - a.strength).findIndex((n) => n.code === code) + 1;
  return (
    <div className="grid gap-4">
      <PageTitle kicker="International football" title={<span className="flex items-center gap-3"><Flag code={code} className="text-3xl" /> {country(code)?.name}</span>} className="-mb-1" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Your caps" value={p.intl.caps} tone="sky" />
        <Stat label="Intl goals" value={p.intl.goals} tone="pitch" />
        <Stat label="Status" value={<span className="text-lg">{p.intl.retired ? "Retired" : inSquad ? "In squad" : "Not selected"}</span>} tone={inSquad ? "sun" : undefined} />
        <Stat label="Pitchborn ranking" value={`#${rank}`} sub={`strength ${nt?.strength ?? "—"}`} />
      </div>
      <AllegianceCard g={g} />
      <IntlNumberCard g={g} />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card title="Current squad" action={nt ? <TeamForm form={nt.form} /> : undefined}>
          {squad.length ? (
            <Table>
              <tbody>
                {squad.map((x) => (
                  <tr key={x.id} className={`cursor-pointer ${x.isUser ? "bg-sun-2 font-bold" : ""}`} onClick={() => setSel(x)}>
                    <td><span className={`rounded-md border-2 border-line px-1 text-xs font-black ${POS_TONE[x.position]}`}>{x.position}</span></td>
                    <td>{name(x)}</td>
                    <td><span className="flex items-center gap-1.5 text-xs"><Crest clubId={x.clubId} size={16} /> {x.clubId ? teamLabel(x.clubId, true) : "Abroad"}</span></td>
                    <td className="text-right">{age(g, x)}</td>
                    <td className="text-right font-bold">{ovr(x)}</td>
                    <td className="text-right text-xs">{x.intl.caps} caps</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty title="Squad announced before the next international window" icon="🌍" />
          )}
          <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted">
            Manager: {ntCoach?.nationality && <Flag code={ntCoach.nationality} />} <b className="text-ink">{nt?.manager}</b>
            {ntCoach?.born ? ` (${g.season - ntCoach.born})` : ""}. Squads are picked on current ability, form and reputation.
          </p>
        </Card>
        <div className="grid content-start gap-4">
          <Card title="Tournament run">
            {Object.values(g.competitions).filter((c) => c.kind === "international" && c.groups).length ? (
              <ul className="grid gap-2 text-sm">
                {Object.values(g.competitions).filter((c) => c.kind === "international" && c.groups).map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2"><b>{c.shortName}</b> <RunBadge comp={c} teamId={code} /></li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No tournament this summer.</p>
            )}
          </Card>
          <Card title="Matches this season">
            {fixtures.length ? (
              <ul className="grid gap-1 text-sm">
                {fixtures.map(({ c, f }) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <Badge>{f.stage ?? c.shortName}</Badge>
                    <Flag code={f.home} /> {teamLabel(f.home, true)} <span className="scoreboard text-xs">{scoreText(f)}</span> {teamLabel(f.away, true)} <Flag code={f.away} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">International windows: September, October, November and March. Tournaments in even summers.</p>
            )}
          </Card>
          <Card title="Honours">
            {nt?.titles.length ? (
              <ul className="text-sm">{nt.titles.map((t) => <li key={t.compId}>🏆 {t.name} {t.season + 1}</li>)}</ul>
            ) : (
              <p className="text-sm text-muted">No major titles in the Pitchborn era yet.</p>
            )}
          </Card>
        </div>
      </div>
      <PlayerModal g={g} p={sel} onClose={() => setSel(null)} />
    </div>
  );
}
