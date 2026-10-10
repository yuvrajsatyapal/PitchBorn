"use client";
import { SponsorSlot } from "@/ads/SponsorSections";
import { intlTeam } from "@/engine/national/identity";
import Link from "next/link";
import { Crest } from "@/components/art/Crest";
import { JerseyChoiceCard } from "@/components/game/NumberPicker";
import { RecentRatings } from "@/components/game/RecentRatings";
import { IconicShowcase } from "@/components/game/IconicShowcase";
import { VaultCard } from "@/components/game/VaultCard";
import { AwardsNightCard, DecisionCards, FixtureRow, MiniTable, PendingMatchCard, PlayerHero, TeamForm } from "@/components/game/widgets";
import { Badge, Card, Empty, LinkButton, Stat } from "@/components/ui";
import { BALANCE } from "@/engine/balance";
import { windowName } from "@/engine/calendar";
import { clubName } from "@/engine/data/world";
import { TRAINING_FOCUS, INTENSITY } from "@/engine/players/development";
import { keeperMetrics } from "@/engine/players/keeper";
import { fmtRating, seasonTotal, user, userFixtures, userLeague } from "@/game/selectors";
import { useGameState } from "@/game/store";

export default function Dashboard() {
  const g = useGameState();
  if (!g) return null;
  const p = user(g);
  const league = userLeague(g);
  const fixtures = userFixtures(g);
  const upcoming = fixtures.filter((x) => !x.f.result).slice(0, 5);
  const recent = fixtures.filter((x) => x.f.result).slice(-4).reverse();
  const tot = seasonTotal(p);
  const openOffers = g.user.offers.filter((o) => o.status === "terms" || o.status === "club-pending");
  const club = p.clubId ? g.clubs[p.clubId] : null;
  const lowMinutes = g.turn > 14 && g.turn < 44 && tot.minutes < (g.turn - 4) * 25;
  const win = windowName(g.turn);

  if (g.user.retired) {
    return (
      <div className="grid gap-4">
        <Card title="Career over" tone="plum">
          <p className="mb-3">You have retired from professional football. Your legacy has been written.</p>
          <LinkButton href="/play/legacy" tone="plum">
            View legacy ▸
          </LinkButton>
        </Card>
        <IconicShowcase g={g} limit={3} final />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <PlayerHero g={g} p={p} />
      <SponsorSlot />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <PendingMatchCard g={g} />
          <VaultCard g={g} />
          <AwardsNightCard g={g} />
          <JerseyChoiceCard g={g} />
          <DecisionCards g={g} />
          {openOffers.length > 0 && (
            <Card tone="sky" title={`📨 ${openOffers.length} open offer${openOffers.length > 1 ? "s" : ""}`} action={<LinkButton href="/play/transfers" size="sm">Review</LinkButton>}>
              <ul className="grid gap-1 text-sm">
                {openOffers.slice(0, 3).map((o) => (
                  <li key={o.id} className="flex items-center gap-2">
                    <Crest clubId={o.fromClubId} size={20} />
                    <span className="font-semibold">{clubName(o.fromClubId)}</span>
                    <Badge tone={o.status === "terms" ? "pitch" : "sun"}>{o.kind === "renewal" ? "Renewal" : o.kind === "loan" ? "Loan" : o.status === "terms" ? "Talks open" : "Bid pending"}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {lowMinutes && !p.loan && (
            <Card tone="sun" title="Agent's advice">
              <p className="text-sm">
                You&apos;ve played only {tot.minutes} minutes this season. Regular football matters for development — consider asking for a loan or a move in the next window.
              </p>
              <div className="mt-2">
                <LinkButton href="/play/transfers" size="sm" tone="paper">
                  Career options
                </LinkButton>
              </div>
            </Card>
          )}
          <Card title="This season" action={<Link href="/play/stats" className="pb-hit text-sm font-bold underline">All stats</Link>}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <Stat label="Apps" value={tot.apps} />
              {p.position === "GK" ? (
                <>
                  <Stat label="Clean sheets" value={tot.cleanSheets} tone="pitch" sub={tot.apps ? `${Math.round(keeperMetrics(tot).cleanSheetRate * 100)}% of games` : undefined} />
                  <Stat label="Save %" value={tot.saves + tot.conceded ? `${Math.round(keeperMetrics(tot).savePct * 100)}%` : "–"} tone="sky" sub={`${tot.conceded} conceded`} />
                </>
              ) : (
                <>
                  <Stat label="Goals" value={tot.goals} tone="pitch" />
                  <Stat label="Assists" value={tot.assists} tone="sky" />
                </>
              )}
              <Stat label="Avg" value={fmtRating(tot)} tone="sun" />
              <Stat label="MotM" value={tot.motm} />
              <Stat label="Mins" value={tot.minutes} />
            </div>
            {g.user.reserves && g.user.reserves.season === g.season && g.user.reserves.apps > 0 && (
              <p className="mt-2 text-xs text-ink-2">
                Development squad: {g.user.reserves.apps} apps · {g.user.reserves.goals} goals · {g.user.reserves.assists} assists · avg {(g.user.reserves.ratingSum / g.user.reserves.apps).toFixed(2)}
              </p>
            )}
            <div className="mt-3">
              <RecentRatings g={g} />
            </div>
          </Card>
          <Card title="Training" action={<LinkButton href="/play/training" size="sm" tone="paper">Change</LinkButton>}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="pitch">{TRAINING_FOCUS[g.user.training.focus].label}</Badge>
              <Badge tone={g.user.training.intensity === "intense" ? "coral" : "paper"}>{INTENSITY[g.user.training.intensity].label}</Badge>
              <span className="text-ink-2">{g.user.lastTraining?.note ?? "Training starts this week."}</span>
            </div>
          </Card>
        </div>
        <div className="grid content-start gap-4">
          {league?.table ? (
            <Card title={league.name} action={<Link href="/play/league" className="pb-hit text-sm font-bold underline">Full table</Link>}>
              <MiniTable table={league.table} highlight={p.clubId ?? undefined} promo={league.tier && league.tier > 1 ? 3 : 4} releg={league.tier === 3 ? 0 : 3} />
              {club && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted">Club form</span>
                  <TeamForm form={club.form} />
                </div>
              )}
            </Card>
          ) : (
            <Card title="No club">
              <Empty title="You're a free agent" icon="🧳">
                Clubs can sign you at any time. Keep training and check your offers.
              </Empty>
            </Card>
          )}
          <Card title="Fixtures" action={<Link href="/play/schedule" className="pb-hit text-sm font-bold underline">Schedule</Link>}>
            {upcoming.length || recent.length ? (
              <>
                <ul className="divide-y divide-line/10 sm:grid sm:grid-cols-[3rem_minmax(0,1fr)_auto_auto]">
                  {upcoming.map(({ comp, f }, i) => (
                    <FixtureRow key={f.id} next={i === 0} comp={comp} f={f} teamId={f.home === p.clubId || f.away === p.clubId ? p.clubId! : intlTeam(p)} />
                  ))}
                  {recent.length > 0 && (
                    <li className="mb-1 mt-4 border-t-0 px-2 text-[11px] font-black uppercase tracking-wider text-muted sm:col-span-4">Recent</li>
                  )}
                  {recent.map(({ comp, f }) => (
                    <FixtureRow key={f.id} comp={comp} f={f} teamId={f.home === p.clubId || f.away === p.clubId ? p.clubId! : intlTeam(p)} />
                  ))}
                </ul>
              </>
            ) : (
              <Empty title={g.turn > BALANCE.calendar.endOfSeasonTurn ? "Summer break" : "Pre-season"} icon="🌞">
                {win ? "The transfer window is open." : "Fixtures will appear here."}
              </Empty>
            )}
          </Card>
          <Card title="Latest news" action={<Link href="/play/world" className="pb-hit text-sm font-bold underline">All news</Link>}>
            {g.news.length ? (
              <ul className="grid gap-2">
                {g.news.slice(0, 7).map((n) => (
                  <li key={n.id} className={`rounded-xl border-2 px-3 py-2 text-sm ${n.important ? "border-line bg-sun-2" : "border-line/20"}`}>
                    <div className="font-semibold">{n.title}</div>
                    {n.body && <div className="text-xs text-ink-2">{n.body}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="Quiet week" icon="📰" />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
