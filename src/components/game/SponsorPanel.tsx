"use client";
import { Badge, Button, Card } from "@/components/ui";
import { Stars } from "@/components/game/widgets";
import { APPEAL_LEVELS, CATEGORY_LABEL, TARGET_LABEL, appealDrivers, appealLabel, brandOf, commercialAppeal, sponsorState, targetProgress, weeksLeft } from "@/engine/career/sponsors";
import { formatMoney } from "@/engine/players/economy";
import type { GameState, SponsorDeal } from "@/engine/types";
import { BALANCE } from "@/engine/balance";
import { useGame } from "@/game/store";

const WEEKS_PER_MONTH = 4;

function duration(weeks: number): string {
  if (weeks >= 52) return `${(weeks / 50).toFixed(1).replace(/\.0$/, "")} years`;
  const months = Math.max(1, Math.round(weeks / WEEKS_PER_MONTH));
  return months === 1 ? "1 month" : `${months} months`;
}

/** This season's target for a deal: a progress bar while open, the outcome once settled. */
function DealTarget({ g, d }: { g: GameState; d: SponsorDeal }) {
  const t = d.target;
  if (!t || t.season !== g.season) {
    return <div className="text-[11px] text-muted">A season target is set once the league season is under way.</div>;
  }
  const [done, need] = targetProgress(g, t);
  const label = TARGET_LABEL[t.kind].many;
  if (t.status === "met") return <div className="text-xs font-bold text-pitch">Target hit: {need} {label} · {formatMoney(t.bonus)} bonus paid</div>;
  if (t.status === "missed") return <div className="text-xs text-coral">Target missed this season ({done}/{need} {label})</div>;
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span>Target: <b className="num">{need}</b> {label} for a <b>{formatMoney(t.bonus)}</b> bonus</span>
        <span className="num font-bold">{done}/{need}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-line bg-paper-2" role="progressbar" aria-valuemin={0} aria-valuemax={need} aria-valuenow={done} aria-label={`${done} of ${need} ${label}`}>
        <div className="h-full bg-pitch" style={{ width: `${Math.round((done / Math.max(1, need)) * 100)}%` }} />
      </div>
    </div>
  );
}

/** The form clause, with a warning once a poor run has started to worry the brand. */
function FormClause({ d }: { d: SponsorDeal }) {
  if (!d.formClause) return null;
  const SP = BALANCE.sponsors;
  const worried = (d.poorWeeks ?? 0) >= SP.warnWeeks;
  return (
    <div className={`text-[11px] ${worried ? "font-bold text-coral" : "text-muted"}`}>
      {worried ? `Form clause: ${d.poorWeeks} weeks of poor form. They walk after ${SP.dropWeeks}.` : "Form clause: the brand can pull out after a long run of poor form."}
    </div>
  );
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
                    <div className="text-[11px] text-ink-2">Season target bonus: {formatMoney(Math.round(o.annual * BALANCE.sponsors.bonusShare))}{o.formClause ? " · form clause" : ""}</div>
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
                <li key={d.id} className="grid gap-2 rounded-xl border-2 border-line p-3" data-testid="sponsor-deal">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold">{b.name}</div>
                      <div className="text-xs text-ink-2">{CATEGORY_LABEL[b.category]} · <b>{formatMoney(d.annual)}</b> / year</div>
                    </div>
                    <div className="text-right text-xs text-ink-2">
                      {duration(weeks)} left
                      {weeks <= 10 && <div className="font-bold text-coral">{renewing ? "Renewal offered" : d.renewalHandled ? "Not renewing" : "Ending soon"}</div>}
                    </div>
                  </div>
                  <DealTarget g={g} d={d} />
                  <FormClause d={d} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
