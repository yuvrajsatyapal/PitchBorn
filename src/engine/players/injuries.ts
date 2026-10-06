import { BALANCE } from "../balance";
import { clamp, r2, type Rng } from "../rng";
import type { Injury, InjurySeverity, Player } from "../types";

interface InjuryType {
  type: string;
  area: string;
  severity: InjurySeverity;
  weeks: [number, number];
  weight: number;
  /** Lasting physical cost (attribute points) for the worst injuries. */
  lasting?: number;
}

const TYPES: InjuryType[] = [
  { type: "Dead leg", area: "thigh", severity: "knock", weeks: [0, 1], weight: 16 },
  { type: "Bruised ankle", area: "ankle", severity: "knock", weeks: [0, 1], weight: 12 },
  { type: "Tight calf", area: "calf", severity: "knock", weeks: [1, 1], weight: 10 },
  { type: "Hamstring strain", area: "hamstring", severity: "minor", weeks: [2, 4], weight: 14 },
  { type: "Groin strain", area: "groin", severity: "minor", weeks: [1, 3], weight: 9 },
  { type: "Ankle sprain", area: "ankle", severity: "minor", weeks: [2, 4], weight: 10 },
  { type: "Concussion", area: "head", severity: "minor", weeks: [1, 2], weight: 4 },
  { type: "Back spasms", area: "back", severity: "minor", weeks: [1, 2], weight: 5 },
  { type: "Torn hamstring", area: "hamstring", severity: "moderate", weeks: [4, 8], weight: 6 },
  { type: "Knee sprain", area: "knee", severity: "moderate", weeks: [3, 7], weight: 5 },
  { type: "Calf tear", area: "calf", severity: "moderate", weeks: [4, 7], weight: 4 },
  { type: "Fractured metatarsal", area: "foot", severity: "serious", weeks: [8, 12], weight: 2.2, lasting: 0.5 },
  { type: "Knee ligament damage", area: "knee", severity: "serious", weeks: [10, 18], weight: 1.8, lasting: 1 },
  { type: "Ruptured ACL", area: "knee", severity: "severe", weeks: [26, 38], weight: 0.6, lasting: 3 },
  { type: "Achilles rupture", area: "achilles", severity: "severe", weeks: [24, 34], weight: 0.3, lasting: 3 },
];

export const SEVERITY_LABEL: Record<InjurySeverity, string> = {
  knock: "Knock", minor: "Minor", moderate: "Moderate", serious: "Serious", severe: "Severe",
};

/** Probability multiplier from proneness, fitness and recent injury history. */
export function injuryRiskFactor(p: Player): number {
  const prone = 0.6 + (p.hidden.injuryProneness / 100) * BALANCE.injuries.pronenessScale * 0.6;
  const tired = p.fitness < BALANCE.fitness.riskHigh ? BALANCE.injuries.lowFitnessMultiplier : p.fitness < BALANCE.fitness.riskMild ? 1.3 : 1;
  const age = p.birthYear ? 1 : 1;
  return prone * tired * age;
}

export function rollInjury(rng: Rng, p: Player, opts: { context: "match" | "training"; seriousAllowed: boolean }): Injury {
  let pool = TYPES;
  if (!opts.seriousAllowed || opts.context === "training") pool = TYPES.filter((t) => t.severity !== "serious" && t.severity !== "severe");
  const t = rng.weighted(pool, (x) => x.weight * (opts.context === "training" && x.severity === "knock" ? 1.5 : 1));
  const weeks = rng.int(t.weeks[0], t.weeks[1]);
  return { type: t.type, area: t.area, severity: t.severity, weeksLeft: weeks, totalWeeks: weeks };
}

/** Apply lasting effects when an injury is first sustained. */
export function applyInjury(rng: Rng, p: Player, injury: Injury): void {
  p.injury = injury.weeksLeft > 0 ? injury : null;
  p.injuries++;
  const t = TYPES.find((x) => x.type === injury.type);
  if (t?.lasting) {
    p.attrs.pace = r2(clamp(p.attrs.pace - t.lasting * rng.range(0.5, 1.2), 1, 99));
    p.attrs.acceleration = r2(clamp(p.attrs.acceleration - t.lasting * rng.range(0.5, 1.2), 1, 99));
  }
  if (injury.weeksLeft > 0) p.fitness = Math.min(p.fitness, 60);
}

/** Weekly recovery tick. Returns true if the player returned to fitness this week. */
export function recoverWeek(p: Player, physioBonus = 0): boolean {
  if (!p.injury) return false;
  p.injury.weeksLeft -= 1 + physioBonus;
  if (p.injury.weeksLeft <= 0) {
    const long = p.injury.totalWeeks >= 6;
    p.injury = null;
    p.fitness = Math.min(p.fitness, long ? 70 : 85);
    p.sharpness = Math.min(p.sharpness, long ? 35 : 55);
    return true;
  }
  p.fitness = Math.min(p.fitness, 60);
  p.sharpness = Math.max(10, p.sharpness - 5);
  return false;
}
