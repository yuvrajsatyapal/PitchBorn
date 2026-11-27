"use client";
import { RatingChart, type ChartMatch } from "@/components/game/RatingChart";
import { Badge, Card, Empty, PageTitle, Stat } from "@/components/ui";
import { seasonLabel } from "@/engine/calendar";
import { seasonReview } from "@/engine/career/seasonReview";
import { teamLabel } from "@/game/selectors";
import { useGameState } from "@/game/store";

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

export default function SeasonReviewPage() {
  const g = useGameState();
  if (!g) return null;
  const r = seasonReview(g);
  const log = (g.user.matchLog ?? []).filter((m) => m.season === r.season);
  const chart: ChartMatch[] = log.map((m) => ({ key: m.fixtureId, season: m.season, turn: m.turn, rating: m.rating, opponent: teamLabel(m.opponent, true), minutes: m.minutes, goals: m.goals, assists: m.assists }));
  return (
    <div className="grid gap-4" data-testid="season-review">
      <PageTitle kicker={`${seasonLabel(r.season)} · age ${r.age}${r.club ? ` · ${r.club}` : ""}`} title="Season in Review" className="-mb-1" />
      {!r.apps ? (
        <Empty title="No senior games this season" icon="📋">Get on the pitch and this page fills up with your season.</Empty>
      ) : (
        <>
          <Card tone="sun">
            <p className="font-display text-2xl">{r.verdict}</p>
            {r.leaguePosition && <p className="mt-1 text-sm">The club finished <b>{ordinal(r.leaguePosition.pos)}</b> of {r.leaguePosition.of} in the {r.leaguePosition.league}.</p>}
            {(r.trophies.length > 0 || r.awards.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.trophies.map((t) => <Badge key={t} tone="sun">🏆 {t}</Badge>)}
                {r.awards.map((a) => <Badge key={a} tone="plum">🥇 {a}</Badge>)}
              </div>
            )}
          </Card>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Games" value={r.apps} sub={`${r.starts} starts · ${r.record.w}W ${r.record.d}D ${r.record.l}L`} />
            <Stat label="Goals" value={r.goals} tone={r.goals ? "pitch" : undefined} />
            <Stat label="Assists" value={r.assists} />
            <Stat label="Average rating" value={r.avgRating?.toFixed(2) ?? "–"} sub={r.overall.start !== undefined ? `overall ${r.overall.start} → ${r.overall.now}` : `overall ${r.overall.now}`} tone="sun" />
          </div>
          <Card title="📈 Rating trend">
            <RatingChart matches={chart} size="large" variant="line" average={r.avgRating ?? undefined} />
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="⭐ Best performances">
              <ul className="grid gap-1.5">
                {r.best.map((m) => (
                  <li key={m.fixtureId} className="flex items-center justify-between gap-2 rounded-lg border-2 border-line/20 px-2.5 py-1.5 text-sm">
                    <span>{m.home ? "vs" : "at"} <b>{teamLabel(m.opponent, true)}</b> · {m.score[0]}-{m.score[1]}{m.goals ? ` · ${m.goals} goal${m.goals > 1 ? "s" : ""}` : ""}{m.assists ? ` · ${m.assists} assist${m.assists > 1 ? "s" : ""}` : ""}</span>
                    <Badge tone="pitch">{m.rating.toFixed(1)}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="🎞️ Moments of the season">
              {r.moments.length ? (
                <ul className="grid gap-1.5">
                  {r.moments.map((m, i) => (
                    <li key={i} className="text-sm"><span aria-hidden>{m.icon}</span> <b>{m.title}</b> <span className="text-ink-2">— {m.line}</span></li>
                  ))}
                </ul>
              ) : <p className="text-sm text-ink-2">No standout moments this time.</p>}
            </Card>
          </div>
          <Card title="🤝 Dressing room">
            {r.bonds.length ? (
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {r.bonds.map((b) => (
                  <li key={b.name} className="flex items-center justify-between gap-2 rounded-lg border-2 border-line/20 px-2.5 py-1.5 text-sm">
                    <span><b>{b.name}</b> <span className="text-ink-2">· {b.label}</span></span>
                    <span className={b.to >= b.from ? "font-bold text-pitch" : "font-bold text-coral"}>{b.from} → {b.to}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-2">Your relationships held steady this season.</p>}
          </Card>
          {(r.stories.length > 0 || r.goalsDone.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card title="🎭 Off the pitch">
                {r.stories.length ? (
                  <ul className="grid gap-1.5">
                    {r.stories.map((d, i) => (
                      <li key={i} className="text-sm"><b>{d.title}</b> <span className="text-ink-2">— {d.outcome}</span></li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-ink-2">A quiet season away from the pitch.</p>}
              </Card>
              <Card title="🎯 Weekly goals">
                {r.goalsDone.length ? (
                  <ul className="grid gap-1.5">
                    {r.goalsDone.map((x, i) => (
                      <li key={i} className="text-sm"><b>{x.label}</b>{x.reward && <span className="text-ink-2"> · unlocked {x.reward}</span>}</li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-ink-2">No weekly goals completed this season.</p>}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
