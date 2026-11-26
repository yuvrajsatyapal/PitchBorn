/**
 * Injury and recovery choices for the user's player. A moderate or worse injury asks how to handle it: rush back, follow
 * the plan or rest fully; serious injuries add surgery or conservative treatment. A specialist clinic, paid from the
 * bank, shortens any recovery. Every injury to the same body area makes the next one likelier, a rushed return carries
 * a re-injury risk for a few weeks, and a third severe injury to one area late in a career can end it.
 *
 * Randomness comes from `Rng.fromSeed(seed:recovery:<turnIndex>)`, so choosing an option never moves the world RNG.
 */
import { formatMoney } from "../players/economy";
import { ageOf } from "../players/generate";
import { clamp, Rng } from "../rng";
import type { CareerDecision, GameState, Injury, Player, RecoveryChoice, RecoveryState } from "../types";
import { addNews, addTimeline, nextId, userPlayer } from "../world/helpers";
import { adjustRel } from "./relationships";

const R = {
  /** Weeks multipliers per choice. */
  weeks: { rush: 0.6, plan: 1, rest: 1.3, clinic: 0.7, surgery: 1.15, conservative: 0.75 } as Record<string, number>,
  /** Weeks of extra re-injury risk after rushing back, and how big it is. */
  rushWindow: 6,
  rushRisk: 2.2,
  /** Risk added for each earlier injury to the same area (applied to the overall factor through the worst area). */
  perRepeat: 0.18,
  /** Clinic price in weeks of wages, with a floor. */
  clinicWeeks: 3,
  clinicMin: 15_000,
  /** Third severe injury to an area at this age or older can end a career. */
  threatAge: 30,
  threatChance: 0.45,
};

export function recoveryOf(state: GameState): RecoveryState {
  return (state.user.recovery ??= { areas: {}, clinics: 0, clinicSpent: 0 });
}

const rngFor = (state: GameState, tag: string) => Rng.fromSeed(`${state.seed}:recovery:${tag}:${state.turnIndex}`);

export function clinicCost(state: GameState): number {
  const wage = userPlayer(state).contract?.wage ?? 0;
  return Math.max(R.clinicMin, Math.round((wage * R.clinicWeeks) / 1000) * 1000);
}

/** Multiplier on the user's injury chance from his history: repeat areas and a recent rushed return. */
export function recoveryRiskFactor(state: GameState): number {
  const r = state.user.recovery;
  if (!r) return 1;
  const worst = Math.max(0, ...Object.values(r.areas).map((n) => n - 1));
  let f = 1 + Math.min(3, worst) * R.perRepeat;
  if (r.rushedUntil !== undefined && state.turnIndex <= r.rushedUntil) f *= R.rushRisk;
  return f;
}

const isBig = (i: Injury) => i.severity === "moderate" || i.severity === "serious" || i.severity === "severe";

/**
 * Called once when the user picks up an injury. Records the area and, for anything moderate or worse, asks how to
 * handle it. A re-injury to the area he rushed back from lasts longer.
 */
export function onUserInjury(state: GameState, injury: Injury): void {
  const r = recoveryOf(state);
  const p = userPlayer(state);
  const before = r.areas[injury.area] ?? 0;
  r.areas[injury.area] = before + 1;
  const rushedHere = r.rushedUntil !== undefined && state.turnIndex <= r.rushedUntil && r.rushedArea === injury.area;
  if (rushedHere && p.injury) {
    const extra = Math.max(1, Math.round(p.injury.totalWeeks * 0.4));
    p.injury.weeksLeft += extra;
    p.injury.totalWeeks += extra;
    addNews(state, { kind: "injury", title: "The same injury again", body: `Coming back too soon has cost you: ${extra} more week${extra === 1 ? "" : "s"} out.`, important: true });
  }
  r.rushedUntil = undefined;
  r.rushedArea = undefined;
  if (!p.injury || !isBig(injury)) return;
  state.user.decisions = state.user.decisions.filter((d) => d.handler !== "recovery");

  const age = ageOf(p, state.season);
  const severe = injury.severity === "severe";
  if (severe && before >= 2 && age >= R.threatAge && rngFor(state, "threat").chance(R.threatChance)) {
    r.careerThreat = { area: injury.area, season: state.season };
    pushDecision(state, {
      title: "Your body is telling you something",
      body: `A third severe ${injury.area} injury at ${age}. The specialists say another comeback is possible but would take far longer, and they would understand if you called it a day.`,
      options: [
        { id: "fight-on", label: "Fight on", hint: `A long road back: ${Math.round(injury.totalWeeks * 1.5)} weeks, and the risk stays high` },
        { id: "retire", label: "Retire from football", hint: "End the career on your own terms" },
      ],
      fallback: "fight-on",
    });
    return;
  }
  const cost = clinicCost(state);
  const canClinic = state.user.bank >= cost;
  const weeks = injury.totalWeeks;
  const w = (k: string) => Math.max(1, Math.round(weeks * R.weeks[k]));
  const serious = injury.severity !== "moderate";
  const options: CareerDecision["options"] = serious
    ? [
        { id: "surgery", label: "Surgery", hint: `About ${w("surgery")} weeks; the safest long-term fix` },
        { id: "conservative", label: "Conservative treatment", hint: `About ${w("conservative")} weeks; quicker, but the area stays fragile` },
      ]
    : [
        { id: "rush", label: "Rush back", hint: `About ${w("rush")} weeks; real risk of breaking down again` },
        { id: "plan", label: "Follow the medical plan", hint: `About ${weeks} weeks` },
        { id: "rest", label: "Rest fully", hint: `About ${w("rest")} weeks; come back fresh and sharper` },
      ];
  options.push({
    id: "clinic",
    label: "Specialist clinic",
    hint: canClinic ? `${formatMoney(cost)} from your bank; about ${w("clinic")} weeks, no extra risk` : `Costs ${formatMoney(cost)}; you can't afford it`,
  });
  pushDecision(state, {
    title: `${injury.type}: how do you want to handle it?`,
    body: `The medical team expect ${weeks} week${weeks === 1 ? "" : "s"} out. How you approach the recovery is your call.`,
    options,
    fallback: serious ? "surgery" : "plan",
  });
}

function pushDecision(state: GameState, d: Pick<CareerDecision, "title" | "body" | "options" | "fallback">) {
  state.user.decisions.push({
    id: nextId(state, "d"),
    kind: "event",
    handler: "recovery",
    eventId: "recovery",
    expiresTurn: state.turn + 2,
    season: state.season,
    ...d,
  });
}

function scaleInjury(p: Player, mul: number) {
  if (!p.injury) return;
  const total = Math.max(1, Math.round(p.injury.totalWeeks * mul));
  const done = p.injury.totalWeeks - p.injury.weeksLeft;
  p.injury.totalWeeks = total;
  p.injury.weeksLeft = Math.max(1, total - done);
}

/** Resolve a recovery decision. `retire` is handled by the caller (it needs the season orchestrator). */
export function resolveRecovery(state: GameState, d: CareerDecision, optionId: string): { msg: string; retire?: boolean } {
  const r = recoveryOf(state);
  const p = userPlayer(state);
  let choice = optionId as RecoveryChoice;
  if (choice === "clinic" && state.user.bank < clinicCost(state)) choice = d.fallback as RecoveryChoice;
  if (choice === "retire") return { msg: "You decide to retire.", retire: true };
  if (!p.injury) return { msg: "You are already back in training." };
  const type = p.injury.type;
  r.current = { type, choice, season: state.season };
  switch (choice) {
    case "fight-on":
      scaleInjury(p, 1.5);
      r.areas[p.injury.area] = (r.areas[p.injury.area] ?? 0) + 1;
      p.morale = clamp(p.morale + 4, 0, 100);
      addTimeline(state, { kind: "injury", title: "Chose to fight on", detail: `${type}: ${p.injury.totalWeeks} weeks of rehab` });
      adjustRel(state, "supporters", 4, "Refused to give up after a third severe injury");
      return { msg: `You will fight on: ${p.injury.totalWeeks} weeks of rehab ahead.` };
    case "rush":
      scaleInjury(p, R.weeks.rush);
      r.rushedUntil = state.turnIndex + (p.injury?.weeksLeft ?? 0) + R.rushWindow;
      r.rushedArea = p.injury?.area;
      adjustRel(state, "manager", 2, "Pushed to come back early");
      return { msg: `Back in about ${p.injury?.weeksLeft} weeks, but the risk of breaking down is high for a while.` };
    case "rest":
      scaleInjury(p, R.weeks.rest);
      // Fully healed: the area counts for less next time.
      r.areas[p.injury.area] = Math.max(1, (r.areas[p.injury.area] ?? 1) - 1);
      p.morale = clamp(p.morale + 2, 0, 100);
      return { msg: `You will take it slowly: about ${p.injury?.weeksLeft} weeks.` };
    case "clinic": {
      const cost = clinicCost(state);
      state.user.bank -= cost;
      r.clinics++;
      r.clinicSpent += cost;
      scaleInjury(p, R.weeks.clinic);
      return { msg: `Booked into a specialist clinic for ${formatMoney(cost)}: about ${p.injury?.weeksLeft} weeks.` };
    }
    case "surgery":
      scaleInjury(p, R.weeks.surgery);
      r.areas[p.injury.area] = Math.max(1, (r.areas[p.injury.area] ?? 1) - 1);
      addTimeline(state, { kind: "injury", title: `Surgery: ${type}`, detail: `${p.injury?.totalWeeks} weeks out` });
      return { msg: `Surgery done. About ${p.injury?.weeksLeft} weeks of rehab.` };
    case "conservative":
      scaleInjury(p, R.weeks.conservative);
      r.areas[p.injury.area] = (r.areas[p.injury.area] ?? 0) + 1;
      p.attrs.pace = clamp(p.attrs.pace - 0.5, 1, 99);
      return { msg: `No surgery: about ${p.injury?.weeksLeft} weeks, though the area stays fragile.` };
    default:
      return { msg: `You follow the medical plan: ${p.injury.weeksLeft} weeks.` };
  }
}

/** Weeks from a return a rushed player is still at risk (for the UI). */
export function rushRiskWeeks(state: GameState): number {
  const r = state.user.recovery;
  if (!r?.rushedUntil || state.user.retired) return 0;
  return Math.max(0, r.rushedUntil - state.turnIndex);
}

