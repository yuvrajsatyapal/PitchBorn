"use client";
import { intlTeam } from "@/engine/national/identity";
import { Crest } from "@/components/art/Crest";
import { JerseyCard } from "@/components/game/NumberPicker";
import { PlayIdentityCard } from "@/components/game/PlayIdentity";
import { IconicShowcase } from "@/components/game/IconicShowcase";
import { HonoursCard, RivalriesCard } from "@/components/game/RivalCards";
import { PlayerHero, scoutStars, Stars } from "@/components/game/widgets";
import { AttrValue, Badge, Card, PageTitle, Table } from "@/components/ui";
import { clubName, countryName } from "@/engine/data/world";
import { POSITION_LABEL, overallFor } from "@/engine/players/attributes";
import { ATTR_LABEL, groupsFor } from "@/engine/players/model";
import { avgRating } from "@/engine/players/generate";
import { AMBIDEXTROUS, weakFootLabel } from "@/engine/players/foot";
import { hasTrait } from "@/engine/traits/effects";
import { seasonLabel } from "@/engine/calendar";
import { age, user } from "@/game/selectors";
import { useGameState } from "@/game/store";

export default function Profile() {
  const g = useGameState();
  if (!g) return null;
  const p = user(g);
  const groups = groupsFor(p.position);
  const LINE: Record<string, readonly string[]> = {
    GK: ["GK"],
    DEF: ["CB", "RB", "LB"],
    MID: ["DM", "CM", "AM"],
    ATT: ["ST", "RW", "LW", "AM"],
  };
  const myLine = LINE[Object.keys(LINE).find((k) => LINE[k].includes(p.position)) ?? "MID"];
  // Own position first, then neighbours on the same line, so a striker never sees only defenders.
  const posOverall = (["GK", "CB", "RB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"] as const)
    .map((pos) => ({ pos, v: overallFor(p.attrs, pos), rank: pos === p.position ? 0 : myLine.includes(pos) ? 1 : 2 }))
    .sort((a, b) => a.rank - b.rank || b.v - a.v)
    .slice(0, 4);
  return (
    <div className="grid gap-4">
      <PageTitle kicker="My player" title="Player profile" className="-mb-1" />
      <PlayerHero g={g} p={p} />
      <JerseyCard g={g} />
      <HonoursCard g={g} />
      <RivalriesCard g={g} />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Attributes">
          <div className="gap-x-6 sm:columns-2">
            {groups.map((gr) => (
              <div key={gr.label} className="mb-4 break-inside-avoid">
                <h3 className="mb-1 text-xs font-black uppercase tracking-wider text-muted">{gr.label}</h3>
                <ul className="grid gap-1">
                  {gr.keys.map((k) => (
                    <li key={k} className="flex items-center justify-between text-sm">
                      <span>{ATTR_LABEL[k]}</span>
                      <AttrValue v={p.attrs[k]} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
        <div className="grid content-start gap-4">
          <Card title="Scouting report">
            <div className="mb-2 flex items-center gap-2 text-sm">
              Potential: <Stars value={scoutStars(g, p)} />
            </div>
            <div className="mt-3 text-sm">
              <div className="mb-1 font-bold">Best positions</div>
              <div className="flex flex-wrap gap-1.5">
                {posOverall.map((x) => (
                  <Badge key={x.pos} tone={x.pos === p.position ? "sun" : "paper"}>
                    {x.pos} {x.v}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
          <PlayIdentityCard g={g} p={p} />
          <IconicShowcase g={g} limit={3} title="Memories" />
          <Card title="Bio">
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-muted">Position</dt>
              <dd>{POSITION_LABEL[p.position]}</dd>
              <dt className="text-muted">Age</dt>
              <dd>{age(g, p)}</dd>
              <dt className="text-muted">Nationality</dt>
              <dd>{countryName(p.nationality)}{p.altNationality ? ` / ${countryName(p.altNationality)}` : ""}</dd>
              <dt className="text-muted">Plays for</dt>
              <dd>{countryName(intlTeam(p))}{p.intl.tiedTo ? " (cap-tied)" : ""}</dd>
              <dt className="text-muted">Height</dt>
              <dd>{p.height} cm</dd>
              <dt className="text-muted">Foot</dt>
              <dd>{p.foot === "L" ? "Left" : "Right"}{hasTrait(p, AMBIDEXTROUS) ? " · Ambidextrous" : ""}</dd>
              <dt className="text-muted">Weak foot</dt>
              <dd>{weakFootLabel(p.weakFoot)} <span className="text-muted">({Math.round(p.weakFoot)})</span></dd>
              <dt className="text-muted">Reputation</dt>
              <dd>{Math.round(p.reputation)} domestic · {Math.round(p.intlReputation)} intl</dd>
              <dt className="text-muted">Career</dt>
              <dd>
                {p.career.apps} apps · {p.career.goals} goals · {p.career.assists} assists
              </dd>
              <dt className="text-muted">International</dt>
              <dd>
                {p.intl.caps} caps · {p.intl.goals} goals{p.intl.retired ? " (retired)" : ""}
              </dd>
              <dt className="text-muted">Injuries</dt>
              <dd>{p.injuries}</dd>
            </dl>
          </Card>
        </div>
      </div>
      <Card title="Development by season">
        {p.history.length ? (
          <Table>
            <thead>
              <tr>
                <th>Season</th>
                <th>Club</th>
                <th>Age</th>
                <th className="text-right">OVR</th>
                <th className="text-right">Apps</th>
                <th className="text-right">G</th>
                <th className="text-right">A</th>
                <th className="text-right">Avg</th>
              </tr>
            </thead>
            <tbody>
              {[...p.history].reverse().map((h) => (
                <tr key={h.season}>
                  <td>{seasonLabel(h.season)}</td>
                  <td>
                    <span className="flex items-center gap-1.5">
                      <Crest clubId={h.clubId} size={16} /> {clubName(h.clubId, true)}
                    </span>
                  </td>
                  <td>{h.age}</td>
                  <td className="text-right font-bold">{h.overall}</td>
                  <td className="text-right">{h.stats.apps}</td>
                  <td className="text-right">{h.stats.goals}</td>
                  <td className="text-right">{h.stats.assists}</td>
                  <td className="text-right">{h.stats.apps ? avgRating(h.stats).toFixed(2) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-muted">Your first season is underway — history appears after it ends.</p>
        )}
      </Card>
    </div>
  );
}
