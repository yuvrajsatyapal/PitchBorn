"use client";
import { useMemo, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { CLAUSE_LIMIT, extrasWeekly, relevantClauses, signingBonusCeiling, type ClauseKey } from "@/engine/career/contracts";
import { CLAUSE_NAME, ROLE_LABEL } from "@/engine/career/offers";
import { formatMoney, marketValue, marketWage } from "@/engine/players/economy";
import type { ContractTerms, GameState, SquadRole, TransferOffer } from "@/engine/types";
import { user } from "@/game/selectors";
import { useGame } from "@/game/store";

const ROLES: SquadRole[] = ["star", "first", "rotation", "backup", "prospect"];
const CLAUSE_HELP: Record<ClauseKey, string> = {
  appearanceBonus: "Paid each time you play.",
  goalBonus: "Paid per goal you score.",
  assistBonus: "Paid per assist.",
  cleanSheetBonus: "Paid when you play 60+ minutes and the team keeps a clean sheet.",
  trophyBonus: "Paid once if the club wins a trophy you played a part in.",
  promotionBonus: "Paid once if the club is promoted and you played 10+ games.",
  wageRise: "Your weekly wage rises by this each season you stay.",
};
const MAIN: ClauseKey[] = ["appearanceBonus", "goalBonus", "cleanSheetBonus"];
const ADVANCED: ClauseKey[] = ["assistBonus", "trophyBonus", "promotionBonus", "wageRise"];

type Draft = ContractTerms;

function Slider({ label, value, min, max, step, onChange, display, help, offered }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display: string; help?: string; offered?: string }) {
  return (
    <label className="grid gap-1 text-xs font-bold">
      <span className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <span className="tabular-nums">{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--pitch)]" aria-label={label} />
      {(help || offered) && (
        <span className="flex justify-between gap-2 text-[11px] font-normal text-muted">
          <span>{help}</span>
          {offered && <span>Their offer: {offered}</span>}
        </span>
      )}
    </label>
  );
}

/** The negotiation form: the original wage, role and length, plus signing bonus, release clause and bonuses. */
export function Negotiation({ o, g }: { o: TransferOffer; g: GameState }) {
  const negotiate = useGame((s) => s.negotiate);
  const p = user(g);
  const club = g.clubs[o.fromClubId];
  const t0 = o.terms;
  const relevant = useMemo(() => new Set(relevantClauses(p.position)), [p.position]);
  const [d, setD] = useState<Draft>({ ...t0, wage: Math.round(t0.wage * 1.15) });
  const [advanced, setAdvanced] = useState(false);
  const value = marketValue(p, g.season);
  const cap = Math.max(signingBonusCeiling(club, p, d.wage), t0.signingBonus);
  const min = t0.wage;
  const max = Math.round(t0.wage * 1.8);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const clauseMax = (k: ClauseKey) => (k === "wageRise" ? CLAUSE_LIMIT.wageRise : Math.max(10, Math.round(d.wage * CLAUSE_LIMIT[k])));
  const clauseStep = (k: ClauseKey) => (k === "wageRise" ? 0.01 : Math.max(10, Math.round(d.wage * 0.005 / 10) * 10));
  const fmtClause = (k: ClauseKey, v: number | undefined) => (k === "wageRise" ? `${Math.round((v ?? 0) * 100)}% a year` : v ? formatMoney(v) : "None");
  // How the package compares with their opening one, so trade-offs are visible: more bonus means less room for wage.
  const theirs = d.wage + 0;
  const delta = (extrasWeekly(d, p, club, g) + d.wage) / (extrasWeekly(t0, p, club, g) + t0.wage) - 1;
  void theirs;
  const clauseOptions = [0, 2, 3, 4, 6].map((m) => (m === 0 ? 0 : Math.round((value * m) / 5e5) * 5e5));
  const clauseNow = d.releaseClause ?? 0;
  const changed = (k: keyof Draft) => (d[k] ?? 0) !== (t0[k] ?? 0);
  const row = (label: string, now: string, was: string, diff: boolean) => (
    <tr key={label} className={diff ? "bg-sun-2 font-bold" : ""}>
      <td className="py-0.5 pr-2">{label}</td>
      <td className="pr-2 text-right tabular-nums">{was}</td>
      <td className="text-right tabular-nums">{now}</td>
    </tr>
  );
  const render = (k: ClauseKey) =>
    relevant.has(k) && (
      <Slider key={k} label={CLAUSE_NAME[k][0].toUpperCase() + CLAUSE_NAME[k].slice(1)} value={d[k] ?? 0} min={0} max={clauseMax(k)} step={clauseStep(k)} onChange={(v) => set(k, v || undefined)} display={fmtClause(k, d[k])} help={CLAUSE_HELP[k]} offered={fmtClause(k, t0[k])} />
    );
  return (
    <div className="mt-3 rounded-xl border-2 border-line bg-card p-3" data-testid="negotiation">
      {o.kind === "renewal" && (
        <p className="mb-3 text-[11px] text-muted">
          Other clubs would pay you about <b className="text-ink">{formatMoney(marketWage(p, g.season))}</b> a week.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Slider label="Weekly wage" value={d.wage} min={min} max={max} step={Math.max(100, Math.round(min / 50))} onChange={(v) => set("wage", v)} display={formatMoney(d.wage)} offered={formatMoney(t0.wage)} />
        <label className="grid gap-1 text-xs font-bold">
          Squad role
          <select value={d.role} onChange={(e) => set("role", e.target.value as SquadRole)} className="rounded-lg border-2 border-line bg-card px-2 py-1.5 text-sm">
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <span className="text-[11px] font-normal text-muted">A star or first-team role means you&apos;re expected to play.</span>
        </label>
        <label className="grid gap-1 text-xs font-bold">
          {o.kind === "renewal" ? "Extra years" : "Length"}
          <select value={d.years} onChange={(e) => set("years", Number(e.target.value))} className="rounded-lg border-2 border-line bg-card px-2 py-1.5 text-sm" disabled={o.kind === "loan"}>
            {[1, 2, 3, 4, 5].map((y) => (
              <option key={y} value={y}>{y} year{y > 1 ? "s" : ""}</option>
            ))}
          </select>
          <span className="text-[11px] font-normal text-muted">Longer is secure but makes a move cost more.</span>
        </label>
      </div>
      {o.kind !== "loan" && (
        <>
          <div className="mt-3 grid gap-3 border-t border-line/15 pt-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="main-terms">
            <Slider label="Signing bonus" value={d.signingBonus} min={0} max={Math.max(cap, 1000)} step={Math.max(1000, Math.round(cap / 60 / 1000) * 1000)} onChange={(v) => set("signingBonus", v)} display={formatMoney(d.signingBonus)} help={cap ? `Paid once when you sign. Up to ${formatMoney(cap)}.` : "The club can't afford one."} offered={formatMoney(t0.signingBonus)} />
            <label className="grid gap-1 text-xs font-bold">
              Release clause
              <select value={clauseNow} onChange={(e) => set("releaseClause", Number(e.target.value) || undefined)} className="rounded-lg border-2 border-line bg-card px-2 py-1.5 text-sm" aria-label="Release clause">
                {[...new Set([clauseNow, ...clauseOptions])].sort((a, b) => a - b).map((c) => (
                  <option key={c} value={c}>{c ? formatMoney(c) : "None"}</option>
                ))}
              </select>
              <span className="text-[11px] font-normal text-muted">
                Lower lets bigger clubs buy you more easily; higher suits this club. Their offer: {t0.releaseClause ? formatMoney(t0.releaseClause) : "None"}.
              </span>
            </label>
            {MAIN.map(render)}
          </div>
          <div className="mt-2">
            <button type="button" className="text-xs font-bold underline decoration-dotted" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced} data-testid="advanced-toggle">
              Advanced terms {advanced ? "▾" : "▸"}
            </button>
            {advanced && (
              <div className="mt-2 grid gap-3 rounded-lg border-2 border-line/20 p-2 sm:grid-cols-2" data-testid="advanced-terms">
                {ADVANCED.map(render)}
              </div>
            )}
          </div>
          <table className="mt-3 w-full text-xs" aria-label="Their offer against your request">
            <thead>
              <tr className="text-left text-[11px] uppercase text-muted"><th>Term</th><th className="text-right">Their offer</th><th className="text-right">You ask</th></tr>
            </thead>
            <tbody>
              {row("Weekly wage", formatMoney(d.wage), formatMoney(t0.wage), d.wage !== t0.wage)}
              {row("Signing bonus", formatMoney(d.signingBonus), formatMoney(t0.signingBonus), changed("signingBonus"))}
              {row("Release clause", d.releaseClause ? formatMoney(d.releaseClause) : "None", t0.releaseClause ? formatMoney(t0.releaseClause) : "None", changed("releaseClause"))}
              {[...MAIN, ...ADVANCED].filter((k) => relevant.has(k) && (d[k] || t0[k])).map((k) => row(CLAUSE_NAME[k][0].toUpperCase() + CLAUSE_NAME[k].slice(1), fmtClause(k, d[k]), fmtClause(k, t0[k]), changed(k)))}
              {row("Role · length", `${ROLE_LABEL[d.role]} · ${d.years}y`, `${ROLE_LABEL[t0.role]} · ${t0.years}y`, d.role !== t0.role || d.years !== t0.years)}
            </tbody>
          </table>
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button tone="pitch" size="sm" onClick={() => negotiate(o.id, { type: "accept" })} data-testid="accept-offer">
          Accept current terms
        </Button>
        <Button
          size="sm"
          onClick={() =>
            negotiate(o.id, {
              type: "counter",
              wage: d.wage,
              role: d.role,
              years: d.years,
              signingBonus: d.signingBonus,
              releaseClause: d.releaseClause ?? null,
              appearanceBonus: d.appearanceBonus ?? 0,
              goalBonus: d.goalBonus ?? 0,
              assistBonus: d.assistBonus ?? 0,
              cleanSheetBonus: d.cleanSheetBonus ?? 0,
              trophyBonus: d.trophyBonus ?? 0,
              promotionBonus: d.promotionBonus ?? 0,
              wageRise: d.wageRise ?? 0,
            })
          }
          disabled={o.kind === "loan"}
          data-testid="counter-offer"
        >
          Counter-offer
        </Button>
        <Button tone="paper" size="sm" onClick={() => setD({ ...t0, wage: Math.round(t0.wage * 1.15) })}>Reset</Button>
        <Button tone="coral" size="sm" onClick={() => negotiate(o.id, { type: "reject" })}>
          Reject
        </Button>
        {o.kind !== "loan" && <Badge tone={delta > 0.12 ? "coral" : delta > 0.04 ? "sun" : "pitch"}>Package {delta >= 0 ? "+" : ""}{Math.round(delta * 100)}% vs their offer</Badge>}
      </div>
      <p className="mt-2 text-[11px] text-muted">They&apos;ll only stretch so far — the wage, bonuses and clauses all come out of one budget, and every counter tests their patience ({o.patience} left). A better agent squeezes a little more.</p>
    </div>
  );
}
