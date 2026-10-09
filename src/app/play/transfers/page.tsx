"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crest } from "@/components/art/Crest";
import { AgentPanel } from "@/components/game/AgentPanel";
import { Negotiation } from "@/components/game/Negotiation";
import { SagaCard } from "@/components/game/SagaCard";
import { Badge, Bar, Button, Card, Empty, Modal, PageTitle, Stat } from "@/components/ui";
import { isTransferWindow, windowName } from "@/engine/calendar";
import { renewalRequestBlock, ROLE_LABEL } from "@/engine/career/offers";
import { clubName, staticLeague } from "@/engine/data/world";
import { formatMoney } from "@/engine/players/economy";
import type { TransferOffer } from "@/engine/types";
import { age, user } from "@/game/selectors";
import { useGame, useGameState } from "@/game/store";

function bonusSummary(t: TransferOffer["terms"]): string {
  const parts: string[] = [];
  if (t.appearanceBonus) parts.push(`${formatMoney(t.appearanceBonus)} per appearance`);
  if (t.goalBonus) parts.push(`${formatMoney(t.goalBonus)} per goal`);
  if (t.assistBonus) parts.push(`${formatMoney(t.assistBonus)} per assist`);
  if (t.cleanSheetBonus) parts.push(`${formatMoney(t.cleanSheetBonus)} per clean sheet`);
  if (t.trophyBonus) parts.push(`${formatMoney(t.trophyBonus)} trophy bonus`);
  if (t.promotionBonus) parts.push(`${formatMoney(t.promotionBonus)} promotion bonus`);
  if (t.wageRise) parts.push(`${Math.round(t.wageRise * 100)}% annual rise`);
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}

function OfferCard({ o }: { o: TransferOffer }) {
  const g = useGameState();
  if (!g) return null;
  const club = g.clubs[o.fromClubId];
  const league = staticLeague(club?.leagueId ?? "");
  const statusTone = o.status === "terms" ? "pitch" : o.status === "club-pending" ? "sun" : o.status === "accepted" ? "sky" : "paper";
  const statusLabel = { "club-pending": "Bid with your club", "club-rejected": "Bid rejected", terms: "Talks open", accepted: "Accepted", rejected: "Rejected", expired: "Expired", withdrawn: "Withdrawn" }[o.status];
  return (
    <li className={`pb-card p-4 ${o.status === "terms" ? "" : "opacity-90"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Crest clubId={o.fromClubId} size={44} />
        <div className="min-w-[10rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-xl">{clubName(o.fromClubId)}</span>
            <Badge tone={statusTone}>{statusLabel}</Badge>
            <Badge>{o.kind === "renewal" ? "Contract renewal" : o.kind === "loan" ? "Loan" : o.kind === "free" ? "Free transfer" : "Transfer"}</Badge>
          </div>
          <div className="text-xs text-muted">
            {league?.name} · reputation {Math.round(club?.reputation ?? 0)}
          </div>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 rounded-xl border-2 border-line bg-card px-2 py-1.5 text-center text-xs sm:w-auto sm:border-0 sm:bg-transparent sm:p-0">
          <div><div className="text-muted">Fee</div><b>{o.fee ? formatMoney(o.fee) : "—"}</b></div>
          <div><div className="text-muted">Wage</div><b>{formatMoney(o.terms.wage)}/wk</b></div>
          <div><div className="text-muted">Role</div><b>{ROLE_LABEL[o.terms.role]}</b></div>
        </div>
      </div>
      <ul className="mt-2 grid gap-0.5 text-xs text-ink-2">
        {o.history.slice(-4).map((h, i) => (
          <li key={i}>• {h}</li>
        ))}
        <li data-testid="offer-terms">
          • {o.terms.years} year{o.terms.years > 1 ? "s" : ""}
          {o.terms.signingBonus > 0 ? ` · signing bonus ${formatMoney(o.terms.signingBonus)}` : ""}
          {o.terms.releaseClause ? ` · release clause ${formatMoney(o.terms.releaseClause)}` : ""}
          {bonusSummary(o.terms)}
        </li>
      </ul>
      {o.status === "terms" && <Negotiation o={o} g={g} />}
    </li>
  );
}

function ContractTimeline({ signed, expires, season }: { signed: number; expires: number; season: number }) {
  const total = Math.max(1, expires - signed + 1);
  const done = Math.max(0, Math.min(total, season - signed));
  const left = expires - season + 1;
  return (
    <div className="col-span-2 sm:col-span-4" data-testid="contract-timeline">
      <div className="mb-1 flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted">
        <span>Signed {signed}</span>
        <span>Expires summer {expires + 1}</span>
      </div>
      <Bar value={done} max={total} tone={left <= 1 ? "coral" : "pitch"} showValue={false} height={12} />
      <div className="mt-1 text-xs text-ink-2">
        {left <= 1 ? "Final season: expect renewal talks, or free-agent interest." : `${left} seasons remaining of a ${total}-season deal.`}
      </div>
    </div>
  );
}

export default function CareerPage() {
  const g = useGameState();
  const transferRequest = useGame((s) => s.transferRequest);
  const requestRenewal = useGame((s) => s.requestRenewal);
  const setWantsLoan = useGame((s) => s.setWantsLoan);
  const retire = useGame((s) => s.retire);
  const retireIntl = useGame((s) => s.retireInternational);
  const [confirm, setConfirm] = useState<"retire" | "intl" | null>(null);
  const router = useRouter();
  if (!g) return null;
  const p = user(g);
  const a = age(g, p);
  const offers = g.user.offers;
  const open = offers.filter((o) => o.status === "terms" || o.status === "club-pending");
  const past = offers.filter((o) => !open.includes(o)).slice(0, 8);
  const win = windowName(g.turn);
  const renewalBlock = renewalRequestBlock(g);
  const squadWages = p.contract ? (g.clubs[p.contract.clubId]?.squad ?? []).map((id) => g.players[id]?.contract?.wage ?? 0).filter((w) => w > 0) : [];
  const wageRank = p.contract && squadWages.length > 1 ? { rank: squadWages.filter((w) => w > p.contract!.wage).length + 1, total: squadWages.length } : null;
  return (
    <div className="grid gap-4">
      <PageTitle kicker={win ? `${win === "summer" ? "Summer" : "January"} window open` : "Transfer window closed"} title="Career & Contract" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Contract" className="lg:col-span-2">
          {p.contract ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Club" value={<span className="flex items-center gap-1.5 text-lg"><Crest clubId={p.contract.clubId} size={22} />{clubName(p.contract.clubId, true)}</span>} />
              <Stat label="Wage" value={formatMoney(p.contract.wage)} sub="per week" />
              <Stat label="Expires" value={`Summer ${p.contract.expires + 1}`} sub={`${p.contract.expires - g.season + 1} season(s) left`} />
              <Stat label="Role" value={<span className="text-lg">{ROLE_LABEL[p.contract.role]}</span>} />
              <Stat label="Market value" value={formatMoney(p.value)} />
              <Stat label="Release clause" value={p.contract.releaseClause ? formatMoney(p.contract.releaseClause) : "None"} />
              <Stat label="Bank" value={formatMoney(g.user.bank)} sub={`Earned ${formatMoney(g.user.earnings)} in total`} />
              <Stat label="Status" value={<span className="text-lg">{p.loan ? `On loan from ${clubName(p.loan.fromClubId, true)}` : g.user.transferRequest ? "Transfer-listed" : "Settled"}</span>} />
              <ContractTimeline signed={p.contract.signed} expires={p.contract.expires} season={g.season} />
              {wageRank && (
                <div className="col-span-2 text-xs text-ink-2 sm:col-span-4" data-testid="wage-rank">
                  Wage rank at {clubName(p.contract.clubId, true)}: <b>{wageRank.rank}</b> of {wageRank.total}
                  {wageRank.rank === 1 ? " · top earner" : ""}
                </div>
              )}
              {bonusSummary(p.contract as unknown as TransferOffer["terms"]) && (
                <div className="col-span-2 text-xs text-ink-2 sm:col-span-4" data-testid="contract-bonuses">Bonuses in your contract{bonusSummary(p.contract as unknown as TransferOffer["terms"]).replace(/^ ·/, ":")}. Each is paid once, when it is earned.</div>
              )}
            </div>
          ) : (
            <Empty title="Free agent" icon="🧳">
              Any club can sign you without a fee, at any time of year. Offers arrive weekly while you&apos;re unattached.
            </Empty>
          )}
        </Card>
        <AgentPanel g={g} />
      </div>
      <Card title="Career moves">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col items-start rounded-xl border-2 border-line p-3">
            <div className="font-bold">New contract</div>
            <p className="mb-3 text-xs text-ink-2">{renewalBlock ?? "Ask your club to open renewal talks."}</p>
            <Button size="sm" className="mt-auto" tone="sun" disabled={!!renewalBlock} onClick={requestRenewal}>
              Request renewal
            </Button>
          </div>
          <div className="flex flex-col items-start rounded-xl border-2 border-line p-3">
            <div className="font-bold">Transfer request</div>
            <p className="mb-3 text-xs text-ink-2">Tell clubs you&apos;re available. Fans and board won&apos;t like it.</p>
            <Button size="sm" className="mt-auto" tone={g.user.transferRequest ? "coral" : "paper"} disabled={!p.clubId || !!p.loan} onClick={() => transferRequest(!g.user.transferRequest)}>
              {g.user.transferRequest ? "Withdraw request" : "Hand in request"}
            </Button>
          </div>
          <div className="flex flex-col items-start rounded-xl border-2 border-line p-3">
            <div className="font-bold">Seek a loan</div>
            <p className="mb-3 text-xs text-ink-2">Young players (≤22) can go out for regular football.</p>
            <Button size="sm" className="mt-auto" tone={g.user.wantsLoan ? "sky" : "paper"} disabled={a > 22 || !p.clubId || !!p.loan} onClick={() => setWantsLoan(!g.user.wantsLoan)}>
              {g.user.wantsLoan ? "Searching…" : "Ask agent"}
            </Button>
          </div>
          <div className="flex flex-col items-start rounded-xl border-2 border-line p-3">
            <div className="font-bold">International duty</div>
            <p className="mb-3 text-xs text-ink-2">{p.intl.retired ? "You have retired from international football." : `${p.intl.caps} caps so far.`}</p>
            <Button size="sm" className="mt-auto" tone="paper" disabled={p.intl.retired || a < 28} onClick={() => setConfirm("intl")}>
              Retire from internationals
            </Button>
          </div>
          <div className="flex flex-col items-start rounded-xl border-2 border-line p-3">
            <div className="font-bold">Hang up your boots</div>
            <p className="mb-3 text-xs text-ink-2">Available from age 32. Your legacy is calculated on retirement.</p>
            <Button size="sm" className="mt-auto" tone="plum" disabled={a < 32 || g.user.retired} onClick={() => setConfirm("retire")}>
              Retire
            </Button>
          </div>
        </div>
        {!isTransferWindow(g.turn) && p.clubId && <p className="mt-3 text-xs text-muted">Players under contract can only move while a transfer window is open: summer (1 July – 31 August) and January (1 – 31 January). Free agents can sign at any time, and contract renewals can be agreed whenever.</p>}
      </Card>
      <SagaCard g={g} />
      <section>
        <h2 className="mb-2 font-display text-2xl">Offers</h2>
        {open.length ? (
          <ul className="grid gap-3">{open.map((o) => <OfferCard key={o.id} o={o} />)}</ul>
        ) : (
          <Empty title="No open offers" icon="📭">
            Clubs watch your form, reputation and contract situation. Play well, and the calls will come.
          </Empty>
        )}
        {past.length > 0 && (
          <>
            <h3 className="mb-2 mt-5 font-display text-lg text-muted">Previous</h3>
            <ul className="grid gap-3">{past.map((o) => <OfferCard key={o.id} o={o} />)}</ul>
          </>
        )}
      </section>
      <Modal open={confirm === "retire"} onClose={() => setConfirm(null)} title="Retire from football?">
        <p className="mb-4 text-sm">This ends your playing career permanently and calculates your Pitchborn legacy. Your save remains viewable.</p>
        <div className="flex justify-end gap-2">
          <Button tone="paper" onClick={() => setConfirm(null)}>Not yet</Button>
          <Button tone="plum" onClick={async () => { setConfirm(null); await retire(); router.push("/play/legacy"); }}>Retire</Button>
        </div>
      </Modal>
      <Modal open={confirm === "intl"} onClose={() => setConfirm(null)} title="Retire from international football?">
        <p className="mb-4 text-sm">You won&apos;t be selected for your country again.</p>
        <div className="flex justify-end gap-2">
          <Button tone="paper" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button tone="coral" onClick={() => { retireIntl(); setConfirm(null); }}>Confirm</Button>
        </div>
      </Modal>
    </div>
  );
}
