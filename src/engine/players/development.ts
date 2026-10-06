import { BALANCE } from "../balance";
import { clamp, r1, r2, Rng } from "../rng";
import type { AttrKey, ClubState, GameState, Player, TrainingFocus, TrainingPlan } from "../types";
import { applyGrowth, overallFor } from "./attributes";
import { ageOf } from "./generate";
import { applyInjury, injuryRiskFactor, rollInjury } from "./injuries";

const D = BALANCE.development;

export const TRAINING_FOCUS: Record<TrainingFocus, { label: string; attrs: AttrKey[]; blurb: string }> = {
  balanced: { label: "Balanced", attrs: [], blurb: "Spread work across your role's key attributes." },
  finishing: { label: "Finishing", attrs: ["finishing", "composure", "longShots"], blurb: "Shooting drills, composure in front of goal." },
  passing: { label: "Passing", attrs: ["passing", "vision", "firstTouch"], blurb: "Rondos, switches of play, weight of pass." },
  dribbling: { label: "Dribbling", attrs: ["dribbling", "firstTouch", "acceleration"], blurb: "Close control and 1v1 work." },
  pace: { label: "Speed", attrs: ["pace", "acceleration"], blurb: "Sprint mechanics. Gains slow after 24." },
  physical: { label: "Physical", attrs: ["strength", "stamina"], blurb: "Gym and conditioning — tiring." },
  defending: { label: "Defending", attrs: ["tackling", "positioning", "heading"], blurb: "Shape, duels and aerial work." },
  setPieces: { label: "Set Pieces", attrs: ["crossing", "longShots", "heading"], blurb: "Deliveries, free kicks and attacking corners." },
  goalkeeping: { label: "Goalkeeping", attrs: ["reflexes", "handling", "diving", "command", "kicking"], blurb: "Shot-stopping and distribution." },
  recovery: { label: "Recovery", attrs: [], blurb: "Rest, physio and analysis. Restores fitness and sharpens the mind." },
};

export const INTENSITY = {
  light: { growth: 0.65, fatigue: 0, injury: 0.5, label: "Light" },
  normal: { growth: 1, fatigue: 3, injury: 1, label: "Normal" },
  intense: { growth: 1.4, fatigue: 7, injury: BALANCE.injuries.intenseMultiplier, label: "Intense" },
} as const;

function ageFactor(age: number): number {
  if (age <= 18) return 1.05;
  if (age <= 20) return 1;
  if (age <= 22) return 0.86;
  if (age <= 24) return 0.62;
  if (age <= 26) return 0.3;
  if (age <= 28) return 0.12;
  return 0.03;
}

/** Deterministic per-season swing so careers have breakthrough and stagnant years. */
export function seasonSwing(p: Player, season: number): number {
  const r = Rng.fromSeed(`${p.id}:${season}`);
  return clamp(r.normal(1, 0.32), 0.3, 1.8);
}

function minutesShare(state: GameState, p: Player): number {
  let mins = 0;
  for (const k in p.season) mins += p.season[k].minutes;
  const elapsed = Math.max(1, Math.min(state.turn, BALANCE.calendar.seasonEnd) - BALANCE.calendar.seasonStart + 1);
  if (state.turn < BALANCE.calendar.seasonStart) return 0.5;
  return clamp(mins / (elapsed * 90 * 0.85), 0, 1);
}

export interface DevContext {
  club: ClubState | null;
  trainingMultiplier: number; // user training contribution
  focus?: AttrKey[];
}

/**
 * Monthly development tick (12 per season). Growth depends on age, distance
 * to potential, minutes, environment, professionalism, morale and a seasonal
 * swing; decline starts after the player's personal peak age.
 */
export function developPlayer(state: GameState, rng: Rng, p: Player, ctx: DevContext, ticksPerSeason = 12): number {
  const age = ageOf(p, state.season);
  const ovr = overallFor(p.attrs, p.position);
  const gap = p.hidden.potential - ovr;
  let growth = 0;
  if (gap > 0) {
    const env = 0.82 + ((ctx.club?.facilities ?? 40) / 100) * 0.22 + ((ctx.club?.manager.quality ?? 50) / 100) * 0.1;
    const prof = 0.8 + (p.hidden.professionalism / 100) * 0.35;
    const mins = 1 - D.minutesWeight + D.minutesWeight * 2 * minutesShare(state, p);
    const morale = 0.9 + (p.morale / 100) * 0.2;
    const formBoost = 1 + clamp(p.form - 6.6, -1, 1.2) * 0.08;
    growth =
      (D.youthGrowth * ageFactor(age) * Math.min(1, gap / 10) * p.hidden.developmentRate * env * prof * mins * morale * formBoost * seasonSwing(p, state.season) * ctx.trainingMultiplier) /
      ticksPerSeason;
    growth += rng.normal(0, 0.12);
    if (ovr >= p.hidden.potential - 0.5) growth = Math.min(growth, 0.05);
  }
  let physical = 0;
  if (age >= p.hidden.peakAge) {
    // Per-season decline grows gently with years past peak (≈1.4 → 3.5 overall/season).
    const years = age - p.hidden.peakAge + 0.5;
    const decline = ((D.declinePerYear + 0.42 * years) * (1.25 - p.hidden.professionalism / 220)) / ticksPerSeason;
    growth -= decline * 0.65;
    physical = decline * 1.3;
  }
  applyGrowth(rng, p.attrs, p.position, growth, ctx.focus, physical);
  return growth;
}

export interface TrainingOutcome {
  fitnessDelta: number;
  growthMultiplier: number;
  injured?: string;
  note: string;
}

/** Weekly user training session. */
export function runTraining(state: GameState, rng: Rng, p: Player, plan: TrainingPlan, boost = 0): TrainingOutcome {
  const int = INTENSITY[plan.intensity];
  if (p.injury) {
    return { fitnessDelta: 0, growthMultiplier: 0, note: "In rehab — training on hold." };
  }
  if (plan.focus === "recovery") {
    const before = p.fitness;
    p.fitness = clamp(p.fitness + 14, 0, 100);
    p.morale = clamp(p.morale + 1.5, 0, 100);
    p.attrs.composure = r2(clamp(p.attrs.composure + 0.03, 1, 99));
    return { fitnessDelta: p.fitness - before, growthMultiplier: 0.25, note: "Recovery week: legs feel fresh." };
  }
  p.fitness = clamp(p.fitness - int.fatigue + 2, 30, 100);
  const risk = BALANCE.injuries.trainingBase * int.injury * injuryRiskFactor(p);
  if (rng.chance(risk)) {
    const injury = rollInjury(rng, p, { context: "training", seriousAllowed: false });
    applyInjury(rng, p, injury);
    state.user.injuryHistory.push({ season: state.season, type: injury.type, weeks: injury.totalWeeks });
    return { fitnessDelta: -int.fatigue, growthMultiplier: 0, injured: injury.type, note: `Picked up a ${injury.type.toLowerCase()} in training.` };
  }
  // Focused drills add small direct gains on top of monthly development.
  const focus = TRAINING_FOCUS[plan.focus].attrs;
  const age = ageOf(p, state.season);
  const ageMul = age <= 21 ? 1 : age <= 25 ? 0.7 : age <= 29 ? 0.4 : 0.2;
  const keys = focus.length ? focus : (Object.keys(p.attrs) as AttrKey[]).filter((k) => !["reflexes", "handling", "diving", "kicking", "command"].includes(k) || p.position === "GK");
  const gap = Math.max(0, p.hidden.potential - overallFor(p.attrs, p.position));
  const capMul = gap > 0 ? 1 : 0.15;
  for (const k of keys) {
    const speedPenalty = (k === "pace" || k === "acceleration") && age > 24 ? 0.4 : 1;
    p.attrs[k] = r2(clamp(p.attrs[k] + 0.045 * int.growth * ageMul * capMul * speedPenalty * (1 + boost) * (focus.length ? 1 : 0.45), 1, 99));
  }
  p.sharpness = clamp(p.sharpness + (plan.intensity === "intense" ? 3 : 1.5), 0, 100);
  return {
    fitnessDelta: -int.fatigue,
    growthMultiplier: int.growth * (1 + boost),
    note: plan.intensity === "intense" ? "Pushed hard this week." : plan.intensity === "light" ? "Kept it light." : "A solid week of work.",
  };
}

/** Weekly condition drift for everyone. */
export function weeklyCondition(p: Player, playedThisWeek: boolean): void {
  if (!p.injury) p.fitness = r1(clamp(p.fitness + BALANCE.fitness.weeklyRecoveryBase + p.attrs.stamina / BALANCE.fitness.weeklyRecoveryStaminaDiv, 0, 100));
  if (!playedThisWeek) {
    p.sharpness = r1(clamp(p.sharpness - 2.5, 15, 100));
    p.form = r2(p.form + (6.6 - p.form) * 0.08);
  }
  p.morale = r1(clamp(p.morale + (65 - p.morale) * 0.04, 0, 100));
  p.fitness = r1(p.fitness);
  p.reputation = r1(p.reputation);
  p.intlReputation = r1(p.intlReputation);
}
