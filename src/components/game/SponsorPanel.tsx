"use client";
import { Badge, Button, Card } from "@/components/ui";
import { Stars } from "@/components/game/widgets";
import { APPEAL_LEVELS, CATEGORY_LABEL, appealDrivers, appealLabel, brandOf, commercialAppeal, sponsorState, weeksLeft } from "@/engine/career/sponsors";
import { formatMoney } from "@/engine/players/economy";
import type { GameState } from "@/engine/types";
import { useGame } from "@/game/store";

const WEEKS_PER_MONTH = 4;

function duration(weeks: number): string {
  if (weeks >= 52) return `${(weeks / 50).toFixed(1).replace(/\.0$/, "")} years`;
  return `${Math.max(1, Math.round(weeks / WEEKS_PER_MONTH))} months`;
}

export function SponsorPanel({ g }: { g: GameState }) {
  const accept = useGame((s) => s.acceptSponsor);
  const decline = useGame((s) => s.declineSponsor);
  const s = sponsorState(g);
  const appeal = commercialAppeal(g);
  const stars = Math.max(1, APPEAL_LEVELS.length - APPEAL_LEVELS.findIndex((l) => appeal >= l.min));
  const drivers = appealDrivers(g);
  const yearly = s.deals.reduce((sum, d) => sum + d.annual, 0);
  return (
    <Card title="Sponsorships" action={yearly > 0 ? <Badge tone="sun">{formatMoney(yearly)} / year</Badge> : undefined}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="sponsor-appeal">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">Commercial appeal</span>
        <span className="font-bold">{appealLabel(appeal)}</span>
        <Stars value={stars} />
      </div>
      {drivers.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{drivers.map((d) => <Badge key={d}>{d}</Badge>)}</div>}

      {s.offers.length > 0 && (
        <div className="mt-4" data-testid="sponsor-offers">
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Available offers</h3>
          <ul className="grid gap-2">
            {s.offers.map((o) => {
              const b = brandOf(o.brandId);
              if (!b) return null;
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-line p-3">
                  <div className="min-w-0">
                    <div className="font-bold">{b.name} {o.renewsDealId && <Badge tone="sky">Renewal</Badge>}</div>
                    <div className="text-xs text-ink-2">{CATEGORY_LABEL[b.category]} · <b>{formatMoney(o.annual)}</b> / year · {o.years} year{o.years > 1 ? "s" : ""}</div>
                    <div className="text-[11px] text-muted">Offer ends in {duration(Math.max(1, o.expiresIndex - g.turnIndex))}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" tone="paper" onClick={() => decline(o.id)}>Decline</Button>
                    <Button size="sm" tone="pitch" onClick={() => accept(o.id)}>Accept</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-4" data-testid="sponsor-deals">
        <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Active deals</h3>
        {s.deals.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-line p-3 text-sm text-ink-2">
            No sponsors yet. Brands approach as your reputation, form and honours grow; better-known players attract bigger names.
          </p>
        ) : (
          <ul className="grid gap-2">
            {s.deals.map((d) => {
              const b = brandOf(d.brandId);
              if (!b) return null;
              const weeks = weeksLeft(g, d);
              const renewing = s.offers.some((o) => o.renewsDealId === d.id);
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-line p-3">
                  <div className="min-w-0">
                    <div className="font-bold">{b.name}</div>
                    <div className="text-xs text-ink-2">{CATEGORY_LABEL[b.category]} · <b>{formatMoney(d.annual)}</b> / year</div>
                  </div>
                  <div className="text-right text-xs text-ink-2">
                    {duration(weeks)} left
                    {weeks <= 10 && <div className="font-bold text-coral">{renewing ? "Renewal offered" : d.renewalHandled ? "Not renewing" : "Ending soon"}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
