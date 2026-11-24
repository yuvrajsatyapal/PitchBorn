/**
 * Sponsorships: fictional brands approach the player once his commercial appeal is high enough, pay a fixed yearly sum
 * weekly through the income ledger, and offer to renew as the deal runs out.
 *
 * Appeal comes from reputation, club standing, form and honours, never from overall alone. Offers are rolled from a seed
 * derived from the turn, so reloading a save never rerolls them. Each deal records the last turn it paid, so a week can
 * never be paid twice.
 */
import { BALANCE } from "../balance";
import { clubName } from "../data/world";
import { formatMoney, roundMoney } from "../players/economy";
import { positionGroup } from "../players/attributes";
import { ageOf } from "../players/generate";
import { Rng, clamp } from "../rng";
import type { GameState, Player, SponsorDeal, SponsorOffer, SponsorState, SponsorTarget, SponsorTargetKind } from "../types";
import { addNews, userPlayer } from "../world/helpers";
import { agentSkill } from "./agents";
import { receiveIncome } from "./money";

const TURNS = BALANCE.calendar.turnsPerSeason;
const CAL = BALANCE.calendar;
const SP = BALANCE.sponsors;

export type SponsorCategory = "boots" | "apparel" | "tech" | "drinks" | "cars" | "watches" | "finance" | "local";

export interface Brand {
  id: string;
  name: string;
  category: SponsorCategory;
  /** Commercial appeal needed before the brand will approach. */
  minAppeal: number;
  /** Multiplier on what the brand pays. */
  rate: number;
}

export const CATEGORY_LABEL: Record<SponsorCategory, string> = {
  boots: "Boot partner",
  apparel: "Apparel partner",
  tech: "Tech partner",
  drinks: "Drinks partner",
  cars: "Car partner",
  watches: "Watch partner",
  finance: "Finance partner",
  local: "Local partner",
};

/** All fictional. Low `minAppeal` brands are the ones that notice a player first. */
export const BRANDS: Brand[] = [
  { id: "dunmore", name: "Dunmore Sports", category: "local", minAppeal: 8, rate: 0.5 },
  { id: "harbour", name: "Harbour Credit Union", category: "finance", minAppeal: 12, rate: 0.55 },
  { id: "lacewing", name: "Lacewing Boots", category: "boots", minAppeal: 18, rate: 0.7 },
  { id: "greenmeadow", name: "Greenmeadow Dairy", category: "drinks", minAppeal: 22, rate: 0.7 },
  { id: "quarkplay", name: "Quarkplay", category: "tech", minAppeal: 28, rate: 0.8 },
  { id: "corvane", name: "Corvane Apparel", category: "apparel", minAppeal: 32, rate: 0.9 },
  { id: "kickara", name: "Kickara", category: "boots", minAppeal: 40, rate: 1.0 },
  { id: "zestro", name: "Zestro Energy", category: "drinks", minAppeal: 46, rate: 1.0 },
  { id: "crestbank", name: "Crestbank", category: "finance", minAppeal: 52, rate: 1.0 },
  { id: "voltara", name: "Voltara", category: "tech", minAppeal: 58, rate: 1.2 },
  { id: "strivon", name: "Strivon", category: "boots", minAppeal: 66, rate: 1.4 },
  { id: "halden", name: "Halden", category: "apparel", minAppeal: 66, rate: 1.3 },
  { id: "nordhawk", name: "Nordhawk Watches", category: "watches", minAppeal: 72, rate: 1.3 },
  { id: "aventra", name: "Aventra Motors", category: "cars", minAppeal: 76, rate: 1.5 },
];

export const brandOf = (id: string): Brand | undefined => BRANDS.find((b) => b.id === id);

/** Pending offers wait this long. */
const OFFER_WAIT = 6;
/** Weeks between one new offer and the next, and before a brand returns after a "no". */
const OFFER_SPACING = 8;
const BRAND_COOLDOWN = 24;
const MAX_PENDING = 3;
/** A renewal is offered this many weeks before the deal ends. */
const RENEWAL_LEAD = 10;

export function sponsorState(state: GameState): SponsorState {
  return (state.user.sponsor ??= { deals: [], offers: [], cooldown: {}, lastOfferIndex: -OFFER_SPACING, seq: 0 });
}

/** How marketable the player is, 0–100. Overall helps only through reputation and honours. */
export function commercialAppeal(state: GameState): number {
  const p = userPlayer(state);
  const club = p.clubId ? state.clubs[p.clubId] : undefined;
  const recent = state.season - 3;
  const honours =
    state.user.trophies.filter((t) => t.season > recent).length * 2 +
    state.user.awards.filter((a) => a.season > recent && ["pots", "topscorer", "goldenglove", "golden-pitch"].includes(a.id)).length * 3;
  const hype = ageOf(p, state.season) <= 21 && p.hidden.potential >= 82 ? 3 : 0;
  const v =
    p.reputation * 0.62 +
    p.intlReputation * 0.14 +
    (club?.reputation ?? 20) * 0.1 +
    clamp((p.form - 6.3) * 6, -4, 9) +
    Math.min(14, honours) +
    hype;
  return Math.round(clamp(v, 0, 100));
}

export const APPEAL_LEVELS: { min: number; label: string }[] = [
  { min: 75, label: "Global Icon" },
  { min: 58, label: "International Star" },
  { min: 40, label: "Nationally Known" },
  { min: 20, label: "Rising Name" },
  { min: 0, label: "Local Prospect" },
];

export function appealLabel(appeal: number): string {
  return (APPEAL_LEVELS.find((l) => appeal >= l.min) ?? APPEAL_LEVELS[APPEAL_LEVELS.length - 1]).label;
}

/** Yearly value the brand would pay today. */
export function annualFor(brand: Brand, appeal: number, state: GameState): number {
  // A good agent squeezes a little more, within bounds.
  const agent = 1 + (agentSkill(state, "negotiation") - 15) / 800;
  return roundMoney(20_000 * Math.exp(appeal / 15) * brand.rate * agent);
}

function yearsFor(appeal: number, rng: Rng): number {
  return appeal >= 55 ? rng.int(2, 3) : appeal >= 25 ? rng.int(1, 3) : rng.int(1, 2);
}

export const weeksLeft = (state: GameState, d: SponsorDeal): number => Math.max(0, d.endIndex - state.turnIndex);

function makeOffer(state: GameState, brand: Brand, appeal: number, rng: Rng, renewsDealId?: string): SponsorOffer {
  const s = sponsorState(state);
  const years = yearsFor(appeal, rng);
  return {
    id: `sp${++s.seq}`,
    brandId: brand.id,
    annual: annualFor(brand, appeal, state),
    years,
    expiresIndex: state.turnIndex + OFFER_WAIT,
    renewsDealId,
    ...(brand.minAppeal >= SP.formClauseAppeal ? { formClause: true } : {}),
  };
}

function newOffers(state: GameState, appeal: number, rng: Rng): void {
  const s = sponsorState(state);
  if (s.offers.length >= MAX_PENDING || state.turnIndex - s.lastOfferIndex < OFFER_SPACING) return;
  // A good media agent finds a few more opportunities; the appeal gate below still decides who may call.
  const chance = clamp(0.06 + appeal / 220 + (agentSkill(state, "media") - 15) / 800, 0.05, 0.5);
  if (!rng.chance(chance)) return;
  const taken = new Set([...s.deals.map((d) => d.brandId), ...s.offers.map((o) => o.brandId)]);
  const taken2 = new Set([...s.deals, ...s.offers].map((x) => brandOf(x.brandId)?.category));
  const eligible = BRANDS.filter((b) => b.minAppeal <= appeal && !taken.has(b.id) && !taken2.has(b.category) && (s.cooldown[b.id] ?? 0) <= state.turnIndex);
  if (!eligible.length) return;
  // Bigger brands are more likely once the player qualifies for them.
  const brand = rng.weighted(eligible, (b) => 1 + b.minAppeal / 25);
  const offer = makeOffer(state, brand, appeal, rng);
  s.offers.push(offer);
  s.lastOfferIndex = state.turnIndex;
  if (brand.minAppeal >= 40) addNews(state, { kind: "contract", title: `${brand.name} wants you as their ${CATEGORY_LABEL[brand.category].toLowerCase()}`, body: `${formatMoney(offer.annual)} a year for ${offer.years} year${offer.years > 1 ? "s" : ""}. See Career & Contract.` });
}

function renewalPass(state: GameState, appeal: number, rng: Rng): void {
  const s = sponsorState(state);
  for (const d of s.deals) {
    if (d.renewalHandled || d.endIndex - state.turnIndex > RENEWAL_LEAD) continue;
    d.renewalHandled = true;
    const brand = brandOf(d.brandId);
    if (!brand) continue;
    // The brand re-evaluates: a player who has slipped well below its level is not renewed.
    if (appeal < brand.minAppeal * 0.8) {
      addNews(state, { kind: "contract", title: `${brand.name} will not renew`, body: "Your deal runs out at the end of its term." });
      continue;
    }
    const offer = makeOffer(state, brand, appeal, rng, d.id);
    offer.expiresIndex = d.endIndex;
    s.offers.push(offer);
  }
}

// ------------------------------------------------------------------------------------------------ season targets

export const TARGET_LABEL: Record<SponsorTargetKind, { one: string; many: string }> = {
  goals: { one: "goal", many: "goals" },
  assists: { one: "assist", many: "assists" },
  involvements: { one: "goal or assist", many: "goals + assists" },
  cleanSheets: { one: "clean sheet", many: "clean sheets" },
  apps: { one: "appearance", many: "appearances" },
};

/** What a brand asks of this player: goals from forwards, involvements or assists from midfielders, clean sheets from keepers, games from defenders. */
export function targetKindFor(p: Pick<Player, "position">): SponsorTargetKind {
  const g = positionGroup(p.position);
  if (g === "GK") return "cleanSheets";
  if (g === "DEF") return "apps";
  if (g === "MID") return p.position === "AM" ? "involvements" : "assists";
  return "goals";
}

function countOf(line: { goals: number; assists: number; cleanSheets: number; apps: number }, kind: SponsorTargetKind): number {
  return kind === "involvements" ? line.goals + line.assists : line[kind];
}

/** The player's tally for `kind` this season, across every competition. */
export function seasonCount(p: Player, kind: SponsorTargetKind): number {
  let n = 0;
  for (const line of Object.values(p.season)) n += countOf(line, kind);
  return n;
}

/** Share of the league season still to play, from this week. */
function seasonLeft(turn: number): number {
  const span = CAL.seasonEnd - CAL.seasonStart + 1;
  return clamp((CAL.seasonEnd - Math.max(turn, CAL.seasonStart) + 1) / span, 0, 1);
}

/** A target for the rest of this season: last season's output (if he played enough) plus a little, pro-rated. */
export function makeTarget(state: GameState, deal: Pick<SponsorDeal, "annual">): SponsorTarget {
  const p = userPlayer(state);
  const kind = targetKindFor(p);
  const last = [...p.history].reverse().find((h) => h.stats.apps > 0);
  const base =
    last && last.stats.apps >= SP.minAppsForHistory
      ? Math.max(countOf(last.stats, kind), SP.minTarget[kind])
      : SP.defaultTarget[kind] * SP.roleScale[p.contract?.role ?? "rotation"];
  const full = kind === "apps" ? Math.min(base, SP.maxApps) : base * SP.stretch;
  const need = Math.max(SP.minTarget[kind], Math.round(full * seasonLeft(state.turn)));
  return { season: state.season, kind, need, baseline: seasonCount(p, kind), bonus: roundMoney(deal.annual * SP.bonusShare), status: "open" };
}

/** Progress towards a target: [done, need]. */
export function targetProgress(state: GameState, t: SponsorTarget): [number, number] {
  const done = t.season === state.season ? Math.max(0, seasonCount(userPlayer(state), t.kind) - t.baseline) : 0;
  return [Math.min(done, t.need), t.need];
}

/** Targets can be set from the start of the season until a month before its end. */
const targetWindow = (turn: number) => turn >= CAL.seasonStart && turn <= CAL.seasonEnd - 4;

function targetsWeekly(state: GameState): void {
  const s = sponsorState(state);
  for (const d of s.deals) {
    const b = brandOf(d.brandId);
    if (!b) continue;
    const t = d.target;
    if (t && t.status === "open") {
      if (t.season !== state.season || state.turn >= CAL.endOfSeasonTurn) {
        t.status = "missed";
        if (t.season === state.season) addNews(state, { kind: "contract", title: `${b.name} target missed`, body: `${targetProgress(state, t)[0]} of ${t.need} ${TARGET_LABEL[t.kind].many}. No bonus this season.` });
      } else {
        const [done, need] = targetProgress(state, t);
        if (done >= need) {
          t.status = "met";
          receiveIncome(state, t.bonus, "sponsor");
          addNews(state, { kind: "contract", title: `${b.name} bonus: ${formatMoney(t.bonus)}`, body: `You hit your target of ${need} ${TARGET_LABEL[t.kind].many}.`, important: true });
        }
      }
    }
    if ((!d.target || d.target.season !== state.season) && targetWindow(state.turn)) d.target = makeTarget(state, d);
  }
}

/** The form clause: a long run of poor form (in weeks he played, in season) brings a warning, then the brand walks. */
function formClauseWeekly(state: GameState): void {
  const s = sponsorState(state);
  const p = userPlayer(state);
  const inSeason = state.turn >= CAL.seasonStart + 4 && state.turn <= CAL.seasonEnd;
  for (const d of [...s.deals]) {
    if (!d.formClause) continue;
    const b = brandOf(d.brandId);
    if (!b) continue;
    if (p.form >= SP.recoveredForm) d.poorWeeks = 0;
    // Only weeks he actually played count: a benched player's form just sits at his last rating.
    const played = state.user.lastMatchTurn === state.turn;
    if (!inSeason || p.injury || !played || p.form >= SP.poorForm) continue;
    d.poorWeeks = (d.poorWeeks ?? 0) + 1;
    if (d.poorWeeks === SP.warnWeeks) {
      addNews(state, { kind: "contract", title: `${b.name} is worried about your form`, body: "Their deal has a form clause. Get back to your best soon or they may pull out.", important: true });
    } else if (d.poorWeeks >= SP.dropWeeks) {
      s.deals = s.deals.filter((x) => x.id !== d.id);
      s.offers = s.offers.filter((o) => o.renewsDealId !== d.id);
      s.cooldown[d.brandId] = state.turnIndex + BRAND_COOLDOWN;
      addNews(state, { kind: "contract", title: `${b.name} ends your deal`, body: "After weeks of poor form, the brand has used the form clause to walk away.", important: true });
    }
  }
}

/** Weekly: pay, expire, renew, and now and then a new approach. Called once per turn. */
export function sponsorWeekly(state: GameState): void {
  if (state.user.retired) return;
  const s = sponsorState(state);
  const now = state.turnIndex;

  for (const d of s.deals) {
    if (now >= d.endIndex || now <= d.paidThrough) continue;
    d.paidThrough = now;
    receiveIncome(state, Math.round(d.annual / TURNS), "sponsor");
  }
  for (const d of s.deals.filter((x) => now + 1 >= x.endIndex)) {
    s.cooldown[d.brandId] = now + BRAND_COOLDOWN / 2;
    const b = brandOf(d.brandId);
    if (b) addNews(state, { kind: "contract", title: `Your ${b.name} deal ends`, body: "Thanks for the partnership." });
  }
  s.deals = s.deals.filter((d) => now + 1 < d.endIndex);
  s.offers = s.offers.filter((o) => o.expiresIndex > now);
  targetsWeekly(state);
  formClauseWeekly(state);

  const rng = Rng.fromSeed(`${state.seed}:sponsor:${now}`);
  const appeal = commercialAppeal(state);
  renewalPass(state, appeal, rng);
  // Roughly monthly, so a quiet stretch is normal.
  if (now % 4 === 0) newOffers(state, appeal, rng);
}

export function acceptSponsorOffer(state: GameState, offerId: string): string {
  const s = sponsorState(state);
  const offer = s.offers.find((o) => o.id === offerId);
  const brand = offer && brandOf(offer.brandId);
  if (!offer || !brand) return "That offer is no longer available.";
  s.offers = s.offers.filter((o) => o.id !== offerId);
  const renewed = offer.renewsDealId ? s.deals.find((d) => d.id === offer.renewsDealId) : undefined;
  if (offer.renewsDealId) s.deals = s.deals.filter((d) => d.id !== offer.renewsDealId);
  else if (s.deals.some((d) => brandOf(d.brandId)?.category === brand.category)) return `You already have a ${brand.category} partner.`;
  const deal: SponsorDeal = {
    id: offer.id,
    brandId: brand.id,
    annual: offer.annual,
    startIndex: state.turnIndex,
    endIndex: state.turnIndex + offer.years * TURNS,
    paidThrough: state.turnIndex - 1,
    renewalHandled: false,
    ...(offer.formClause ? { formClause: true } : {}),
  };
  // A renewal keeps this season's target (met or not): a new deal with the same brand is not a second bonus.
  if (renewed?.target?.season === state.season) deal.target = renewed.target;
  else if (targetWindow(state.turn)) deal.target = makeTarget(state, deal);
  s.deals.push(deal);
  const goal = deal.target ? ` Target this season: ${deal.target.need} ${TARGET_LABEL[deal.target.kind].many} for a ${formatMoney(deal.target.bonus)} bonus.` : "";
  addNews(state, { kind: "contract", title: `You sign with ${brand.name}`, body: `${formatMoney(offer.annual)} a year for ${offer.years} year${offer.years > 1 ? "s" : ""}.${goal}`, important: brand.minAppeal >= 40 });
  return `Signed with ${brand.name}.`;
}

export function declineSponsorOffer(state: GameState, offerId: string): void {
  const s = sponsorState(state);
  const offer = s.offers.find((o) => o.id === offerId);
  if (!offer) return;
  s.offers = s.offers.filter((o) => o.id !== offerId);
  // Declining a renewal lets the deal run out; a new offer just keeps the brand away for a while.
  s.cooldown[offer.brandId] = state.turnIndex + BRAND_COOLDOWN;
}

/** Deals stop when the career does; nothing is owed. */
export function endSponsorshipsOnRetirement(state: GameState): void {
  const s = state.user.sponsor;
  if (!s) return;
  s.deals = [];
  s.offers = [];
}

/** A short list of what is driving the player's appeal, for the panel. */
export function appealDrivers(state: GameState): string[] {
  const p = userPlayer(state);
  const out: string[] = [];
  if (p.intl.caps > 0) out.push("International player");
  if (p.clubId && (state.clubs[p.clubId]?.reputation ?? 0) >= 70) out.push(`Plays for ${clubName(p.clubId, true)}`);
  if (p.form >= 7.1) out.push("Strong form");
  if (state.user.awards.some((a) => a.season >= state.season - 2 && ["pots", "topscorer", "golden-pitch"].includes(a.id))) out.push("Recent major award");
  if (state.user.trophies.some((t) => t.season >= state.season - 2)) out.push("Recent trophy");
  return out;
}
