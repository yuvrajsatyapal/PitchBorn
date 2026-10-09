import { BALANCE } from "../balance";
import { moveScoreDelta, stayBonus } from "../traits/career";
import { noteApproachDeclined, noteRenewal } from "../traits/stay";
import { clubName, staticClub, staticLeague } from "../data/world";
import { annualRevenue, distressDiscount, forcedSales, refusalChance, spendWillingness, transferBudget as ownedBudget, wageTolerance } from "../club/ownership";
import { overallFor, positionGroup } from "../players/attributes";
import { tacticalFit } from "../match/lineup";
import { marketValue, playerWage, formatMoney } from "../players/economy";
import { loyaltyPull, renewalGap, reservationWage, retentionOffer } from "../career/wages";
import { ageOf, generatePlayer } from "../players/generate";
import { clamp, type Rng } from "../rng";
import type { ClubState, GameState, Player, Position, SquadRole } from "../types";
import { assignRoles, clubLevel, generateVirtualPool } from "../world/create";
import { addNews, addToSquad, fullName, nextId, removeFromSquad, squadOf } from "../world/helpers";

const S = BALANCE.squad;

/** How many comparable targets a club weighs up for a need. */
const SHORTLIST = 30;

const MIN_BY_POS: Record<Position, number> = { GK: 3, CB: 3, RB: 1, LB: 1, DM: 1, CM: 2, AM: 1, RW: 1, LW: 1, ST: 2 };

export function ovr(p: Player): number {
  return overallFor(p.attrs, p.position);
}

function starterQuality(squad: Player[], pos: Position): number {
  const best = squad.filter((p) => p.position === pos || p.secondary.includes(pos)).map(ovr).sort((a, b) => b - a);
  return best[0] ?? 0;
}

/** Tactical fit moves a target by at most this many overall points, so it breaks ties between comparable players and never ranks a clearly weaker one first. */
const STYLE_BONUS_MAX = 2;
/** Fit points per overall point of that bonus. */
const STYLE_BONUS_PER = 12;
/** A starter whose profile fits the club's style this badly is a reason to look, if nothing else is wrong. */
const POOR_FIT = 42;

/** What a club adds to a player's attractiveness for fitting how it plays. 0 for a neutral fit. */
export function styleBonus(p: Player, club: Pick<ClubState, "style">): number {
  return clamp((tacticalFit(p, club.style) - 60) / STYLE_BONUS_PER, -STYLE_BONUS_MAX, STYLE_BONUS_MAX);
}

function bestAt(squad: Player[], pos: Position): Player | undefined {
  let best: Player | undefined;
  for (const p of squad) if ((p.position === pos || p.secondary.includes(pos)) && (!best || ovr(p) > ovr(best))) best = p;
  return best;
}

/** Positions a club most urgently wants to strengthen, best first. */
export function squadNeeds(state: GameState, club: ClubState): { pos: Position; urgency: number; floor: number }[] {
  const squad = squadOf(state, club.id).filter((p) => !p.isUser || true);
  const level = clubLevel(club.reputation);
  const needs: { pos: Position; urgency: number; floor: number }[] = [];
  for (const pos of Object.keys(MIN_BY_POS) as Position[]) {
    const count = squad.filter((p) => p.position === pos && ageOf(p, state.season) < 35).length;
    const sq = starterQuality(squad, pos);
    let urgency = 0;
    if (count < MIN_BY_POS[pos]) urgency += 3 * (MIN_BY_POS[pos] - count);
    if (sq < level - 3) urgency += (level - 3 - sq) / 3;
    const aging = squad.filter((p) => p.position === pos && ageOf(p, state.season) >= 32).length;
    urgency += aging * 0.4;
    // "We need a CM" becomes "we need a CM who suits how we play": a starter who fits the style badly nudges the club to look.
    if (urgency > 0 && count >= MIN_BY_POS[pos]) {
      const starter = bestAt(squad, pos);
      if (starter && tacticalFit(starter, club.style) < POOR_FIT) urgency += 0.6;
    }
    if (urgency > 0.5) needs.push({ pos, urgency, floor: Math.max(sq, level - 6) });
  }
  return needs.sort((a, b) => b.urgency - a.urgency);
}

function transferBudget(club: ClubState): number {
  const tier = staticLeague(club.leagueId)?.tier ?? 1;
  const base = club.reputation * club.reputation * (tier === 1 ? 26000 : tier === 2 ? 7000 : 1800);
  return ownedBudget(club, base, annualRevenue(club));
}

/** Clubs squeezed by their finances put their best-paid squad players up for sale; ownership sets how readily. */
export function listForFinancialReasons(state: GameState): void {
  for (const club of Object.values(state.clubs)) {
    const n = forcedSales(club, annualRevenue(club));
    if (n <= 0) continue;
    const squad = squadOf(state, club.id)
      .filter((p) => !p.isUser && !p.listed && p.contract && !p.loan)
      .sort((a, b) => (b.contract?.wage ?? 0) - (a.contract?.wage ?? 0));
    // The very best are kept: sales come from the next tier of earners, which is where a club trims the bill.
    for (const p of squad.slice(2, 2 + n)) p.listed = true;
  }
}

/** Will the player agree to join? */
export function playerWillJoin(state: GameState, p: Player, buyer: ClubState, wage: number): boolean {
  const current = p.clubId ? state.clubs[p.clubId] : null;
  const repGap = buyer.reputation - (current?.reputation ?? 0);
  const wageGain = p.contract ? wage / Math.max(1, p.contract.wage) : 2;
  const ambition = p.hidden.ambition / 100;
  // The more tied he is to his club, the more a rival has to offer to move him.
  const leaveBar = loyaltyPull(state, p) * 5;
  const score = repGap * (0.6 + ambition) + (wageGain - 1) * 30 - leaveBar + (p.listed ? 10 : 0) + moveScoreDelta(state, p, buyer, wageGain);
  return score > -2;
}

export interface MarketIndex {
  byPos: Record<Position, Player[]>;
  free: Player[];
}

export function buildMarketIndex(state: GameState): MarketIndex {
  const byPos = { GK: [], RB: [], CB: [], LB: [], DM: [], CM: [], AM: [], RW: [], LW: [], ST: [] } as Record<Position, Player[]>;
  const free: Player[] = [];
  for (const p of Object.values(state.players)) {
    if (p.virtual || p.retired || p.isUser || p.loan) continue;
    if (!p.clubId) free.push(p);
    byPos[p.position].push(p);
  }
  for (const k of Object.keys(byPos) as Position[]) byPos[k].sort((a, b) => ovr(b) - ovr(a));
  return { byPos, free };
}

export function executeTransfer(state: GameState, p: Player, buyer: ClubState, fee: number, wage: number, years: number, role: SquadRole): void {
  const from = p.clubId;
  const seller = from ? state.clubs[from] : null;
  if (seller) seller.balance += fee;
  buyer.balance -= fee;
  removeFromSquad(state, p.id);
  addToSquad(state, p.id, buyer.id);
  p.loan = undefined;
  p.listed = false;
  p.contract = {
    clubId: buyer.id,
    wage,
    expires: state.season + years - (state.turn >= BALANCE.calendar.endOfSeasonTurn ? 0 : 1),
    signed: state.season,
    role,
    releaseClause: staticClub(buyer.id)?.countryCode === "ESP" ? Math.round((fee || marketValue(p, state.season)) * 3 / 1e6) * 1e6 : undefined,
  };
  p.morale = clamp(p.morale + 8, 0, 100);
  p.value = marketValue(p, state.season);
  state.transferLog.push({ season: state.season, turn: state.turn, playerId: p.id, name: fullName(p), from, to: buyer.id, fee });
  if (state.transferLog.length > 400) state.transferLog.shift();
  const notable = fee >= 25_000_000 || (staticLeague(buyer.leagueId)?.tier === 1 && fee >= 12_000_000);
  if (notable) {
    addNews(state, {
      kind: "transfer",
      title: `${fullName(p)} joins ${clubName(buyer.id)}`,
      body: `${from ? `From ${clubName(from)}` : "On a free transfer"} for ${fee ? formatMoney(fee) : "free"}.`,
    });
  }
}

/** AI transfer activity for one window turn. */
export function runAiTransfers(state: GameState, rng: Rng, intensity: number): void {
  const index = buildMarketIndex(state);
  const clubs = rng.shuffle(Object.values(state.clubs));
  for (const club of clubs) {
    if (!rng.chance(intensity)) continue;
    const squad = squadOf(state, club.id);
    // Trim bloated squads first.
    if (squad.length > S.max) releaseSurplus(state, rng, club, squad);
    if (squad.length >= S.max) continue;
    const needs = squadNeeds(state, club);
    if (!needs.length) continue;
    const need = needs[0];
    const budget = transferBudget(club);
    const revenue = annualRevenue(club);
    const level = clubLevel(club.reputation);
    const candidates = index.byPos[need.pos];
    let signed = false;
    // Free agents first — cheap and quick.
    let freeAgent: Player | undefined;
    let freeScore = -Infinity;
    for (const p of index.free) {
      if (p.position !== need.pos || ovr(p) < need.floor - 2 || ovr(p) > level + 6 || ageOf(p, state.season) > 33) continue;
      const score = ovr(p) + styleBonus(p, club);
      if (score > freeScore) {
        freeScore = score;
        freeAgent = p;
      }
    }
    if (freeAgent) {
      const wage = playerWage(freeAgent, state.season, club.reputation, "rotation");
      executeTransfer(state, freeAgent, club, 0, wage, rng.int(1, 3), "rotation");
      index.free.splice(index.free.indexOf(freeAgent), 1);
      continue;
    }
    // The shortlist is cut by ability first (the list is sorted by it), then ordered by ability plus a bounded credit for fitting the club's style.
    const shortlist: Player[] = [];
    for (let i = 0; i < candidates.length && shortlist.length < SHORTLIST; i++) {
      const p = candidates[i];
      const o = ovr(p);
      if (o > level + 7) continue;
      if (o < need.floor + 1) break; // sorted desc — the rest are worse
      if (!p.clubId || p.clubId === club.id) continue;
      if (ageOf(p, state.season) > 31 && o < level + 3) continue;
      shortlist.push(p);
    }
    const ranked = shortlist.map((p) => ({ p, score: ovr(p) + styleBonus(p, club) })).sort((a, b) => b.score - a.score);
    for (const { p } of ranked) {
      if (signed) break;
      const o = ovr(p);
      const seller = state.clubs[p.clubId ?? ""];
      if (!seller) continue;
      const value = marketValue(p, state.season);
      const sellerSquad = seller.squad.length;
      const key = (p.contract?.role === "star" || p.contract?.role === "first") && seller.reputation >= club.reputation - 5;
      let fee = value * (key ? rng.range(1.3, 1.9) : rng.range(0.9, 1.3));
      if (p.contract?.releaseClause && fee > p.contract.releaseClause) fee = p.contract.releaseClause;
      if (p.contract && p.contract.expires <= state.season) fee *= 0.5;
      if (p.listed) fee *= 1 - distressDiscount(seller, annualRevenue(seller));
      if (fee > budget) continue;
      if (sellerSquad <= S.min && !p.listed) continue;
      if (rng.chance(Math.min(0.9, 0.55 / spendWillingness(club.id)))) continue; // scouting noise — not every target is pursued
      const role: SquadRole = o >= level + 2 ? "star" : "first";
      if (key && !p.listed && rng.chance(refusalChance(seller, club, annualRevenue(seller)))) continue; // a backed seller holds on to its key men
      const wage = Math.round(playerWage(p, state.season, club.reputation, role) * (role === "star" ? wageTolerance(club, revenue) : 1) / 100) * 100;
      if (!playerWillJoin(state, p, club, wage)) {
        // A club with the money and the need came for him and he said no: that is the only outside interest the game really has.
        noteApproachDeclined(state, p, club.reputation);
        continue;
      }
      executeTransfer(state, p, club, Math.round(fee / 50000) * 50000, wage, rng.int(2, 5), role);
      candidates.splice(candidates.indexOf(p), 1);
      signed = true;
    }
  }
}

function releaseSurplus(state: GameState, rng: Rng, club: ClubState, squad: Player[]) {
  const surplus = squad
    .filter((p) => !p.isUser)
    .sort((a, b) => ovr(a) - ovr(b) + (ageOf(b, state.season) - ageOf(a, state.season)) * 0.2)
    .slice(0, Math.max(0, squad.length - S.target - 1));
  for (const p of surplus) {
    removeFromSquad(state, p.id);
    p.clubId = null;
    p.contract = null;
    p.listed = false;
  }
  void rng;
}

/** End-of-season contract decisions for NPCs (before rollover). */
export function processExpiringContracts(state: GameState, rng: Rng): void {
  for (const p of Object.values(state.players)) {
    if (p.isUser || p.virtual || p.retired || !p.contract || p.contract.expires > state.season) continue;
    const club = state.clubs[p.contract.clubId];
    if (!club) continue;
    const level = clubLevel(club.reputation);
    const age = ageOf(p, state.season + 1);
    const o = ovr(p);
    const wanted = (o >= level - 7 && age <= 32) || (age <= 22 && p.hidden.potential >= level - 2);
    const role = p.contract.role === "prospect" && age > 20 ? "rotation" : p.contract.role;
    // The club prices him; the player decides whether that is enough. A club that badly wants him pays up to what he asks.
    const offer = retentionOffer(state, club, p, role);
    const need = reservationWage(state, p);
    const wage = offer.importance >= 0.3 && need > offer.wage && need <= offer.maxWage ? need : offer.wage;
    const gap = renewalGap(state, p, wage);
    const willing = clamp(1 - gap / 0.12, 0, 1);
    const stays = wanted && rng.chance(clamp(0.78 + stayBonus(state, p), 0.3, 0.97) * willing);
    if (stays) {
      noteRenewal(state, p);
      p.contract = { ...p.contract, expires: state.season + rng.int(1, age > 30 ? 2 : 4), wage, signed: state.season + 1 };
    } else {
      removeFromSquad(state, p.id);
      p.clubId = null;
      p.contract = null;
    }
  }
}

function retireProbability(age: number, o: number, clubless: boolean): number {
  const curve = BALANCE.retirement.curve;
  let base = 0;
  for (const [a, pr] of curve) if (age >= a) base = pr;
  if (age < curve[0][0]) base = 0;
  if (o >= 84) base *= 0.6;
  if (clubless) base = Math.min(1, base * 1.8 + (age >= 31 ? 0.15 : 0));
  return base;
}

/** NPC retirements at season end; notable players are kept as legends. */
export function processRetirements(state: GameState, rng: Rng): void {
  for (const p of Object.values(state.players)) {
    if (p.isUser || p.retired) continue;
    const age = ageOf(p, state.season + 1);
    const prob = retireProbability(age, ovr(p), !p.clubId && !p.virtual);
    if (!p.clubId && !p.virtual) {
      // Unsigned players drift out of the professional game.
      const o = ovr(p);
      if (rng.chance(age >= 30 || o < 67 ? 0.55 : 0.2)) {
        retire(state, p);
        continue;
      }
    }
    if (prob > 0 && rng.chance(prob)) retire(state, p);
  }
}

function retire(state: GameState, p: Player) {
  removeFromSquad(state, p.id);
  for (const nt of Object.values(state.nationalTeams)) nt.squad = nt.squad.filter((id) => id !== p.id);
  if (p.career.goals >= 120 || p.career.apps >= 450 || p.intl.caps >= 70 || p.trophies >= 5) {
    state.legends.push({
      id: p.id, name: fullName(p), nationality: p.nationality, goals: p.career.goals, apps: p.career.apps, caps: p.intl.caps,
      peak: Math.round(ovr(p)), retiredSeason: state.season,
    });
    if (state.legends.length > 300) state.legends.splice(0, state.legends.length - 300);
  }
  delete state.players[p.id];
}

/** Summer youth intake: every club promotes a few academy players. */
export function youthIntake(state: GameState, rng: Rng): void {
  const season = state.season;
  let gems = 0;
  for (const club of Object.values(state.clubs)) {
    const st = staticClub(club.id);
    const n = rng.int(1, 3);
    const level = clubLevel(club.reputation);
    for (let i = 0; i < n; i++) {
      const position = rng.pick<Position>(["GK", "CB", "CB", "RB", "LB", "DM", "CM", "CM", "AM", "RW", "LW", "ST", "ST"]);
      const age = rng.int(16, 18);
      const potential = clamp(level - 2 + rng.normal(0, 6) + (club.youth - 50) / 8 + (rng.chance(0.03) ? 9 : 0), 55, 97);
      const p = generatePlayer(rng, {
        id: nextId(state, "p"),
        nationality: rng.chance(0.85) ? st?.countryCode ?? "ENG" : rng.pick(["FRA", "BRA", "NGA", "SEN", "POR", "NED", "ESP"]),
        position, age, season, overall: clamp(potential - 24 - (18 - age) * 2 + rng.normal(0, 3), 45, 72), potential, clubId: club.id,
      });
      p.contract = { clubId: club.id, wage: playerWage(p, season, club.reputation, "prospect"), expires: season + 2, signed: season, role: "prospect", youth: true };
      p.value = marketValue(p, season);
      p.reputation = 3;
      state.players[p.id] = p;
      club.squad.push(p.id);
      if (potential >= 91 && club.reputation >= 80 && gems++ < 3) {
        addNews(state, { kind: "world", title: `${clubName(club.id)} unveil academy gem ${fullName(p)}`, body: `${age}-year-old ${position} tipped for the top.` });
      }
    }
    // Keep squads within bounds after intake.
    const squad = squadOf(state, club.id);
    if (squad.length > S.max) releaseSurplus(state, rng, club, squad);
    assignRoles(squadOf(state, club.id));
  }
}

/** Keep every nation's virtual depth pool topped up. */
export function refreshVirtualPools(state: GameState, rng: Rng): void {
  const counts: Record<string, number> = {};
  for (const p of Object.values(state.players)) if (p.virtual) counts[p.nationality] = (counts[p.nationality] ?? 0) + 1;
  for (const nt of Object.values(state.nationalTeams)) {
    const target = staticNationTarget(nt.code);
    const have = counts[nt.code] ?? 0;
    if (have < target) for (const p of generateVirtualPool(state, rng, nt.code, state.season, target - have)) state.players[p.id] = p;
  }
}

function staticNationTarget(code: string): number {
  return ["ENG", "ESP", "GER", "ITA", "FRA"].includes(code) ? 8 : 24;
}

/** Fill thin squads after windows so every club can field a team. */
export function ensureMinimumSquads(state: GameState, rng: Rng): void {
  const index = buildMarketIndex(state);
  for (const club of Object.values(state.clubs)) {
    let squad = squadOf(state, club.id);
    for (const pos of Object.keys(MIN_BY_POS) as Position[]) {
      const count = squad.filter((p) => p.position === pos).length;
      for (let i = count; i < MIN_BY_POS[pos]; i++) {
        const level = clubLevel(club.reputation);
        const fa = index.free.find((p) => p.position === pos && Math.abs(ovr(p) - level) < 12);
        if (fa) {
          index.free.splice(index.free.indexOf(fa), 1);
          executeTransfer(state, fa, club, 0, playerWage(fa, state.season, club.reputation, "backup"), 1, "backup");
        } else {
          const p = generatePlayer(rng, {
            id: nextId(state, "p"), nationality: staticClub(club.id)?.countryCode ?? "ENG", position: pos, age: rng.int(19, 29), season: state.season,
            overall: level - 6 + rng.normal(0, 2), potential: level - 2, clubId: club.id,
          });
          p.contract = { clubId: club.id, wage: playerWage(p, state.season, club.reputation, "backup"), expires: state.season + 1, signed: state.season, role: "backup" };
          p.value = marketValue(p, state.season);
          state.players[p.id] = p;
          club.squad.push(p.id);
        }
      }
      squad = squadOf(state, club.id);
    }
    while (squad.length < S.min) {
      const pos = rng.pick<Position>(["CB", "CM", "ST", "RW", "LB"]);
      const level = clubLevel(club.reputation);
      const p = generatePlayer(rng, {
        id: nextId(state, "p"), nationality: staticClub(club.id)?.countryCode ?? "ENG", position: pos, age: rng.int(18, 30), season: state.season,
        overall: level - 7 + rng.normal(0, 2), potential: level - 2, clubId: club.id,
      });
      p.contract = { clubId: club.id, wage: playerWage(p, state.season, club.reputation, "backup"), expires: state.season + 1, signed: state.season, role: "backup" };
      state.players[p.id] = p;
      club.squad.push(p.id);
      squad = squadOf(state, club.id);
    }
  }
  void positionGroup;
}
