"use client";
import { useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Flag } from "@/components/art/Flag";
import { RunBadge } from "@/components/game/CompetitionRun";
import { PlayerModal } from "@/components/game/PlayerModal";
import { TeamForm } from "@/components/game/widgets";
import { CompChip, Card, Empty, PageTitle, Stat, Table } from "@/components/ui";
import { country } from "@/engine/data/world";
import type { Player } from "@/engine/types";
import { age, name, ovr, POS_TONE, scoreText, teamLabel, user } from "@/game/selectors";
import { useGameState } from "@/game/store";
import { IntlNumberCard } from "@/components/game/NumberPicker";
import { AllegianceCard } from "@/components/game/AllegianceCard";
import { intlTeam } from "@/engine/national/identity";

const LEADER_ROW = "flex items-center justify-between gap-3 rounded-lg border-2 border-line/20 px-2.5 py-1.5 text-sm";

function NationalLeadersCard({ squad }: { squad: Player[] }) {
  const top = (pick: (x: Player) => number) => squad.reduce<Player | null>((best, x) => (pick(x) > 0 && (!best || pick(x) > pick(best)) ? x : best), null);
  const leaders = [
    { label: "Top scorer", who: top((x) => x.intl.goals), value: (x: Player) => `${x.intl.goals} goals` },
    { label: "Most caps", who: top((x) => x.intl.caps), value: (x: Player) => `${x.intl.caps} caps` },
  ];
  return (
    <Card title="National team leaders" data-testid="national-leaders">
      <ul className="grid gap-3">
        {leaders.map(({ label, who, value }) => (
          <li key={label} className={LEADER_ROW}>
            <span className="min-w-0">
              <span className="block text-[11px] font-black uppercase tracking-wider text-muted">{label}</span>
              <b className={`block truncate ${who ? "" : "text-muted"}`}>{who ? name(who) : "Not decided yet"}</b>
            </span>
            <span className={`shrink-0 font-black tabular-nums ${who ? "" : "text-muted"}`}>{who ? value(who) : "-"}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted">All time for the national team, current squad.</p>
    </Card>
  );
}

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
        <Stat label="Ranking" value={`#${rank}`} sub={`strength ${nt?.strength ?? "—"}`} />
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
                    <CompChip comp={c} stage={f.stage} />
                    <Flag code={f.home} /> {teamLabel(f.home, true)} <span className="scoreboard text-xs">{scoreText(f)}</span> {teamLabel(f.away, true)} <Flag code={f.away} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">International windows: September, October, November and March. Tournaments in even summers.</p>
            )}
          </Card>
          <NationalLeadersCard squad={squad} />
          <Card title="Honours">
            {nt?.titles.length ? (
              <ul className="text-sm">{nt.titles.map((t) => <li key={t.compId}>🏆 {t.name} {t.season + 1}</li>)}</ul>
            ) : (
              <p className="text-sm text-muted">No major titles in the PitchBorn era yet.</p>
            )}
          </Card>
        </div>
      </div>
      <PlayerModal g={g} p={sel} onClose={() => setSel(null)} />
    </div>
  );
}
