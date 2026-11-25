/**
 * Lifestyle and money: what wages buy. A home and a car (one of each), staff who help the body and mind, a charity foundation,
 * and investments. Everything has a weekly cost and a small but steady effect the player can feel: a better home means fuller
 * recovery between games, a physio fewer training knocks, a foundation warmer supporters and a line in the legacy. Upkeep comes
 * out of the bank every week; when it can't be paid, staff and the foundation stop first, then the car and the house go back.
 * Investments settle once a season from their own seeded stream, so money never moves the world RNG.
 */
import { BALANCE } from "../balance";
import { formatMoney } from "../players/economy";
import { clamp, Rng } from "../rng";
import type { GameState, LifestyleHolding, LifestyleState } from "../types";
import { addNews, userPlayer } from "../world/helpers";
import { adjustRel } from "./relationships";

export type LifestyleKind = "home" | "car" | "staff" | "charity";

export interface LifestyleEffects {
  /** Extra fitness recovered each week. */
  recovery?: number;
  /** Morale each week. */
  morale?: number;
  /** Multiplier on the chance of a training injury. */
  injury?: number;
  /** Supporters relationship each week. */
  supporters?: number;
  /** Board relationship each week (flash cars are frowned on). */
  board?: number;
  /** Commercial appeal points while owned. */
  appeal?: number;
  /** Reputation points at the end of each season. */
  reputation?: number;
}

export interface LifestyleItem {
  id: string;
  kind: LifestyleKind;
  name: string;
  icon: string;
  blurb: string;
  price: number;
  upkeep: number;
  effects: LifestyleEffects;
}

export const LIFESTYLE: readonly LifestyleItem[] = [
  { id: "flat", kind: "home", name: "City flat", icon: "🏢", blurb: "Quiet, close to the training ground.", price: 60_000, upkeep: 300, effects: { recovery: 0.6, morale: 0.04 } },
  { id: "townhouse", kind: "home", name: "Townhouse", icon: "🏡", blurb: "Room to switch off after a game.", price: 450_000, upkeep: 1_200, effects: { recovery: 1.1, morale: 0.08 } },
  { id: "villa", kind: "home", name: "Villa with a pool", icon: "🏖️", blurb: "Recovery pool, sauna, total privacy.", price: 2_500_000, upkeep: 5_000, effects: { recovery: 1.6, morale: 0.12 } },
  { id: "estate", kind: "home", name: "Country estate", icon: "🏰", blurb: "Your own pitch, gym and recovery suite.", price: 12_000_000, upkeep: 20_000, effects: { recovery: 2.2, morale: 0.16, appeal: 1 } },
  { id: "hatch", kind: "car", name: "Sensible hatchback", icon: "🚗", blurb: "The fans like a down-to-earth player.", price: 25_000, upkeep: 80, effects: { morale: 0.02, supporters: 0.03 } },
  { id: "sports", kind: "car", name: "Sports car", icon: "🏎️", blurb: "Turns heads at the training ground.", price: 180_000, upkeep: 600, effects: { morale: 0.07, appeal: 2 } },
  { id: "hyper", kind: "car", name: "Hypercar", icon: "🚀", blurb: "Brands love it. The board, less so.", price: 2_200_000, upkeep: 4_000, effects: { morale: 0.12, appeal: 4, board: -0.05 } },
  { id: "chef", kind: "staff", name: "Personal chef", icon: "👨‍🍳", blurb: "Better fuel, quicker recovery.", price: 0, upkeep: 1_500, effects: { recovery: 0.8 } },
  { id: "physio", kind: "staff", name: "Private physio", icon: "🩺", blurb: "Catches knocks before they become injuries.", price: 0, upkeep: 4_000, effects: { injury: 0.8, recovery: 0.4 } },
  { id: "mind", kind: "staff", name: "Performance psychologist", icon: "🧠", blurb: "Keeps your head right through bad runs.", price: 0, upkeep: 2_500, effects: { morale: 0.18 } },
  { id: "local-charity", kind: "charity", name: "Community foundation", icon: "🤝", blurb: "Coaching clinics and kit for local kids.", price: 10_000, upkeep: 1_000, effects: { supporters: 0.15, reputation: 0.5 } },
  { id: "global-charity", kind: "charity", name: "International foundation", icon: "🌍", blurb: "Schools and clean water, with your name on it.", price: 250_000, upkeep: 12_000, effects: { supporters: 0.3, reputation: 1.5, appeal: 2 } },
];

/** One of each of these at a time: buying another replaces (and sells) the old one. */
const SINGLE: ReadonlySet<LifestyleKind> = new Set(["home", "car", "charity"]);
/** Homes and cars sell back for this share of the price. */
const RESALE = 0.7;

export type InvestmentKind = "bonds" | "property" | "startup";

export interface InvestmentDef {
  id: InvestmentKind;
  name: string;
  icon: string;
  blurb: string;
  /** Fee taken when cashing out early. */
  exitFee: number;
}

export const INVESTMENTS: readonly InvestmentDef[] = [
  { id: "bonds", name: "Government bonds", icon: "📜", blurb: "Safe and slow: about 3% a year.", exitFee: 0 },
  { id: "property", name: "Property fund", icon: "🏘️", blurb: "Around 6% a year, but some years it falls.", exitFee: 0.05 },
  { id: "startup", name: "Start-up stake", icon: "💡", blurb: "Settles after a season: often lost, sometimes tripled.", exitFee: 0.5 },
];

export const INVEST_AMOUNTS = [50_000, 500_000, 5_000_000] as const;

export function lifestyleState(state: GameState): LifestyleState {
  return (state.user.lifestyle ??= { owned: [], investments: [], spent: 0, donated: 0 });
}

export function itemById(id: string): LifestyleItem | undefined {
  return LIFESTYLE.find((i) => i.id === id);
}

export function ownedItems(state: GameState): LifestyleItem[] {
  return (state.user.lifestyle?.owned ?? []).map((o) => itemById(o.id)).filter((i): i is LifestyleItem => !!i);
}

/** The combined effect of everything owned. */
export function lifestyleEffects(state: GameState): Required<LifestyleEffects> {
  const fx = { recovery: 0, morale: 0, injury: 1, supporters: 0, board: 0, appeal: 0, reputation: 0 };
  for (const i of ownedItems(state)) {
    fx.recovery += i.effects.recovery ?? 0;
    fx.morale += i.effects.morale ?? 0;
    fx.injury *= i.effects.injury ?? 1;
    fx.supporters += i.effects.supporters ?? 0;
    fx.board += i.effects.board ?? 0;
    fx.appeal += i.effects.appeal ?? 0;
    fx.reputation += i.effects.reputation ?? 0;
  }
  return fx;
}

export function weeklyUpkeep(state: GameState): number {
  return ownedItems(state).reduce((s, i) => s + i.upkeep, 0);
}

export function canBuy(state: GameState, id: string): { ok: boolean; reason?: string } {
  const item = itemById(id);
  if (!item) return { ok: false, reason: "Unknown item" };
  if (state.user.retired) return { ok: false, reason: "Retired" };
  const ls = state.user.lifestyle;
  if (ls?.owned.some((o) => o.id === id)) return { ok: false, reason: "Already yours" };
  const old = SINGLE.has(item.kind) ? ownedItems(state).find((o) => o.kind === item.kind) : undefined;
  const credit = old && old.kind !== "charity" ? Math.round(old.price * RESALE) : 0;
  // Four weeks of upkeep in hand as well, so a purchase can't empty the bank the week it's made.
  const need = item.price + item.upkeep * 4 - credit;
  if (state.user.bank < need) return { ok: false, reason: `Needs ${formatMoney(need)} in the bank` };
  return { ok: true };
}

export function buyItem(state: GameState, id: string): { ok: boolean; reason?: string; msg?: string } {
  const check = canBuy(state, id);
  if (!check.ok) return check;
  const item = itemById(id) as LifestyleItem;
  const ls = lifestyleState(state);
  const old = SINGLE.has(item.kind) ? ownedItems(state).find((o) => o.kind === item.kind) : undefined;
  if (old) sellItem(state, old.id, true);
  state.user.bank -= item.price;
  ls.spent += item.price;
  if (item.kind === "charity") ls.donated += item.price;
  ls.owned.push({ id, season: state.season, turn: state.turn });
  addNews(state, { kind: "career", title: `${item.icon} ${item.kind === "staff" ? `You hire a ${item.name.toLowerCase()}` : item.kind === "charity" ? `You launch a ${item.name.toLowerCase()}` : `You buy a ${item.name.toLowerCase()}`}`, body: `${item.blurb}${item.upkeep ? ` · ${formatMoney(item.upkeep)}/wk` : ""}` });
  return { ok: true, msg: `${item.name}: done.` };
}

export function sellItem(state: GameState, id: string, quiet = false): { ok: boolean; reason?: string; msg?: string } {
  const ls = state.user.lifestyle;
  const item = itemById(id);
  if (!ls || !item || !ls.owned.some((o) => o.id === id)) return { ok: false, reason: "You don't own that" };
  ls.owned = ls.owned.filter((o) => o.id !== id);
  const back = item.kind === "home" || item.kind === "car" ? Math.round(item.price * RESALE) : 0;
  state.user.bank += back;
  if (!quiet) addNews(state, { kind: "career", title: `${item.icon} ${item.kind === "staff" ? `You let your ${item.name.toLowerCase()} go` : item.kind === "charity" ? `Your ${item.name.toLowerCase()} winds down` : `You sell your ${item.name.toLowerCase()}`}`, body: back ? `${formatMoney(back)} back in the bank.` : "No more weekly costs." });
  return { ok: true, msg: back ? `Sold for ${formatMoney(back)}.` : `${item.name} cancelled.` };
}

export function invest(state: GameState, kind: InvestmentKind, amount: number): { ok: boolean; reason?: string; msg?: string } {
  const def = INVESTMENTS.find((i) => i.id === kind);
  if (!def || amount <= 0) return { ok: false, reason: "Unknown investment" };
  if (state.user.retired) return { ok: false, reason: "Retired" };
  if (state.user.bank < amount) return { ok: false, reason: `Needs ${formatMoney(amount)} in the bank` };
  const ls = lifestyleState(state);
  state.user.bank -= amount;
  ls.investments.push({ id: `${kind}-${state.season}-${state.turn}-${ls.investments.length}`, kind, amount, value: amount, season: state.season });
  return { ok: true, msg: `${formatMoney(amount)} into ${def.name.toLowerCase()}.` };
}

export function cashOut(state: GameState, holdingId: string): { ok: boolean; reason?: string; msg?: string } {
  const ls = state.user.lifestyle;
  const h = ls?.investments.find((x) => x.id === holdingId);
  if (!ls || !h) return { ok: false, reason: "No such investment" };
  const def = INVESTMENTS.find((i) => i.id === h.kind) as InvestmentDef;
  const back = Math.round(h.value * (1 - def.exitFee));
  ls.investments = ls.investments.filter((x) => x.id !== holdingId);
  state.user.bank += back;
  return { ok: true, msg: `${formatMoney(back)} back in the bank.` };
}

/** A year's return on one holding, from a stream seeded by the save, the season and the holding. */
function settleHolding(state: GameState, h: LifestyleHolding): { value: number; done: boolean } {
  const rng = Rng.fromSeed(`${state.seed}:invest:${state.season}:${h.id}`);
  if (h.kind === "bonds") return { value: Math.round(h.value * (1.03 + rng.normal(0, 0.005))), done: false };
  if (h.kind === "property") return { value: Math.round(h.value * (1 + clamp(rng.normal(0.06, 0.07), -0.2, 0.3))), done: false };
  const r = rng.next();
  // A start-up stake settles once: about half fail, a third hold their value or a little more, one in six triples.
  const mul = r < 0.5 ? 0.3 : r < 0.84 ? 1.15 : 3;
  return { value: Math.round(h.value * mul), done: true };
}

function settleInvestments(state: GameState): void {
  const ls = state.user.lifestyle;
  if (!ls?.investments.length) return;
  const keep: LifestyleHolding[] = [];
  for (const h of ls.investments) {
    if (h.season === state.season) {
      keep.push(h);
      continue;
    }
    const before = h.value;
    const out = settleHolding(state, h);
    const def = INVESTMENTS.find((i) => i.id === h.kind) as InvestmentDef;
    if (out.done) {
      state.user.bank += out.value;
      addNews(state, { kind: "career", title: `${def.icon} Your start-up stake ${out.value > h.amount ? "pays off" : "goes under"}`, body: `${formatMoney(h.amount)} in, ${formatMoney(out.value)} back.`, important: out.value >= h.amount * 2 });
    } else {
      keep.push({ ...h, value: out.value });
      if (Math.abs(out.value - before) >= 10_000) addNews(state, { kind: "career", title: `${def.icon} ${def.name}: ${out.value >= before ? "+" : ""}${formatMoney(out.value - before)} this year`, body: `Now worth ${formatMoney(out.value)}.` });
    }
  }
  ls.investments = keep;
}

/**
 * Weekly: pay the upkeep and feel the effects. Unpaid upkeep lets things go, least essential first, rather than running the
 * bank into the red. Investments settle once, at the end of the season.
 */
export function lifestyleWeekly(state: GameState): void {
  const ls = state.user.lifestyle;
  if (!ls || state.user.retired) return;
  const order: LifestyleKind[] = ["staff", "charity", "car", "home"];
  while (weeklyUpkeep(state) > state.user.bank && ls.owned.length) {
    const victim = order.map((k) => ownedItems(state).find((i) => i.kind === k)).find((i) => !!i);
    if (!victim) break;
    sellItem(state, victim.id, true);
    addNews(state, { kind: "career", title: `${victim.icon} You can't keep up the payments`, body: `${victim.name} has to go.`, important: true });
  }
  const upkeep = weeklyUpkeep(state);
  state.user.bank -= upkeep;
  ls.spent += upkeep;
  ls.donated += ownedItems(state).filter((i) => i.kind === "charity").reduce((s, i) => s + i.upkeep, 0);
  const fx = lifestyleEffects(state);
  const p = userPlayer(state);
  if (fx.recovery && !p.injury) p.fitness = clamp(p.fitness + fx.recovery, 0, 100);
  if (fx.morale) p.morale = clamp(p.morale + fx.morale, 0, 100);
  if (fx.supporters) adjustRel(state, "supporters", fx.supporters, "Your life off the pitch");
  if (fx.board) adjustRel(state, "board", fx.board, "Your flashy lifestyle");
  if (state.turn === BALANCE.calendar.seasonEnd) {
    if (fx.reputation) p.reputation = clamp(p.reputation + fx.reputation, 0, 100);
    settleInvestments(state);
  }
}

/** Net worth: bank plus what homes, cars and investments would fetch. */
export function netWorth(state: GameState): number {
  const ls = state.user.lifestyle;
  const assets = ownedItems(state).reduce((s, i) => s + (i.kind === "home" || i.kind === "car" ? Math.round(i.price * RESALE) : 0), 0);
  return state.user.bank + assets + (ls?.investments.reduce((s, h) => s + h.value, 0) ?? 0);
}
