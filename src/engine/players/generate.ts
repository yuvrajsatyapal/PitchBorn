import { BALANCE } from "../balance";
import { country } from "../data/world";
import { poolFor } from "../data/names";
import { clamp, type Rng } from "../rng";
import type { Appearance, CountryCode, Hidden, Player, Position, StatLine } from "../types";
import { bestOverall, generateAttributes, overallFor } from "./attributes";

export function emptyStat(): StatLine {
  return {
    apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, conceded: 0, yellow: 0, red: 0,
    ratingSum: 0, motm: 0, shots: 0, shotsOnTarget: 0, keyPasses: 0, tackles: 0, saves: 0,
  };
}

export function addStat(into: StatLine, s: StatLine): void {
  for (const k in s) into[k as keyof StatLine] += s[k as keyof StatLine];
  into.ratingSum = Math.round(into.ratingSum * 10) / 10;
}

export const avgRating = (s: StatLine) => (s.apps ? s.ratingSum / s.apps : 0);

export function ageOf(p: Pick<Player, "birthYear">, season: number): number {
  // Season start year; players "age" at the start of each season.
  return season - p.birthYear;
}

export function overall(p: Player): number {
  return overallFor(p.attrs, p.position);
}

export function bestOf(p: Player): number {
  return bestOverall(p.attrs, [p.position, ...p.secondary]);
}

const SECONDARY: Record<Position, Position[]> = {
  GK: [],
  RB: ["LB", "CB"],
  LB: ["RB", "CB"],
  CB: ["DM", "RB"],
  DM: ["CM", "CB"],
  CM: ["DM", "AM"],
  AM: ["CM", "RW", "LW"],
  RW: ["LW", "AM", "ST"],
  LW: ["RW", "AM", "ST"],
  ST: ["RW", "LW", "AM"],
};

export function secondaryFor(rng: Rng, p: Position): Position[] {
  const opts = SECONDARY[p];
  const n = opts.length ? rng.int(0, Math.min(2, opts.length)) : 0;
  return rng.shuffle([...opts]).slice(0, n);
}

const HEIGHT: Record<Position, [number, number]> = {
  GK: [190, 4], CB: [187, 4], ST: [183, 6], RB: [178, 4], LB: [178, 4], DM: [181, 5], CM: [179, 5], AM: [176, 5], RW: [175, 5], LW: [175, 5],
};

const PEAK: Record<Position, number> = { GK: 31, CB: 29.5, RB: 28, LB: 28, DM: 29, CM: 28.5, AM: 27.5, RW: 27, LW: 27, ST: 28 };

export function randomHeight(rng: Rng, p: Position): number {
  const [m, sd] = HEIGHT[p];
  return Math.round(clamp(rng.normal(m, sd), 160, 205));
}

export function randomHidden(rng: Rng, position: Position, potential: number): Hidden {
  const trait = () => Math.round(clamp(rng.normal(55, 17), 1, 100));
  return {
    potential: Math.round(clamp(potential, 35, 99)),
    consistency: trait(),
    professionalism: trait(),
    ambition: trait(),
    loyalty: trait(),
    injuryProneness: Math.round(clamp(rng.normal(40, 18), 1, 100)),
    adaptability: trait(),
    bigMatch: trait(),
    developmentRate: Math.round(clamp(rng.normal(1, 0.15), 0.65, 1.4) * 100) / 100,
    peakAge: Math.round((PEAK[position] + rng.normal(0, 1.2)) * 10) / 10,
  };
}

const SKIN_BY_POOL: Record<string, number[]> = {
  westafrican: [0, 0, 0, 0, 0.1, 0.9], nigerian: [0, 0, 0, 0, 0.1, 0.9], maghreb: [0.05, 0.25, 0.5, 0.2, 0, 0],
  brazilian: [0.2, 0.2, 0.2, 0.15, 0.15, 0.1], latin: [0.25, 0.3, 0.3, 0.1, 0.05, 0], japanese: [0.3, 0.6, 0.1, 0, 0, 0],
  korean: [0.3, 0.6, 0.1, 0, 0, 0], american: [0.45, 0.15, 0.1, 0.1, 0.1, 0.1], turkish: [0.2, 0.4, 0.35, 0.05, 0, 0],
};
const SKIN_DEFAULT = [0.55, 0.22, 0.08, 0.05, 0.05, 0.05];

export function randomLook(rng: Rng, namePool: string): Appearance {
  const dist = SKIN_BY_POOL[namePool] ?? SKIN_DEFAULT;
  const skin = rng.weighted([0, 1, 2, 3, 4, 5], (i) => dist[i]);
  return {
    skin,
    hair: rng.int(0, 7),
    hairColor: skin >= 3 ? rng.weighted([0, 1, 2], (i) => [0.85, 0.12, 0.03][i]) : rng.int(0, 5),
    facial: rng.weighted([0, 1, 2, 3], (i) => [0.55, 0.2, 0.15, 0.1][i]),
    eyes: rng.int(0, 2),
  };
}

export function randomName(rng: Rng, nationality: CountryCode): { firstName: string; lastName: string } {
  const pool = poolFor(country(nationality)?.namePool ?? "english");
  return { firstName: rng.pick(pool.first), lastName: rng.pick(pool.last) };
}

function randomFoot(rng: Rng, p: Position): "L" | "R" | "B" {
  const leftBias = p === "LB" || p === "LW" ? 0.55 : p === "RW" ? 0.35 : 0.2;
  const r = rng.next();
  if (r < 0.05) return "B";
  return r < 0.05 + leftBias ? "L" : "R";
}

export interface GenerateOptions {
  id: string;
  nationality: CountryCode;
  position: Position;
  age: number;
  season: number;
  overall: number;
  potential: number;
  clubId: string | null;
  virtual?: boolean;
}

export function generatePlayer(rng: Rng, o: GenerateOptions): Player {
  const height = randomHeight(rng, o.position);
  const attrs = generateAttributes(rng, o.position, o.overall, height);
  const ovr = overallFor(attrs, o.position);
  const potential = Math.max(ovr, Math.round(o.potential));
  const name = randomName(rng, o.nationality);
  const rep = clamp((ovr - 45) * 1.6 + rng.normal(0, 4), 1, 95);
  const p: Player = {
    id: o.id,
    ...name,
    nationality: o.nationality,
    birthYear: o.season - o.age,
    position: o.position,
    secondary: secondaryFor(rng, o.position),
    foot: randomFoot(rng, o.position),
    height,
    attrs,
    hidden: randomHidden(rng, o.position, potential),
    clubId: o.clubId,
    contract: null,
    fitness: 100,
    morale: Math.round(clamp(rng.normal(68, 10), 30, 95)),
    form: 6.6,
    sharpness: 70,
    injury: null,
    injuries: 0,
    suspension: 0,
    yellowAccum: 0,
    reputation: Math.round(rep),
    intlReputation: Math.round(clamp(rep - 15, 1, 90)),
    value: 0,
    season: {},
    career: emptyStat(),
    history: [],
    intl: { caps: 0, goals: 0, retired: false },
    look: randomLook(rng, country(o.nationality)?.namePool ?? "english"),
    virtual: o.virtual,
    trophies: 0,
    month: { apps: 0, ratingSum: 0, goals: 0, assists: 0 },
  };
  // Seed plausible past career numbers for veterans so records/caps feel lived-in.
  const seasonsPlayed = Math.max(0, o.age - 19);
  if (seasonsPlayed > 0 && !o.virtual) {
    const appsPer = 18 + (ovr - 60) * 0.4;
    const goalRate = { GK: 0, CB: 0.04, RB: 0.03, LB: 0.03, DM: 0.05, CM: 0.1, AM: 0.22, RW: 0.25, LW: 0.25, ST: 0.42 }[o.position];
    p.career.apps = Math.max(0, Math.round(seasonsPlayed * clamp(appsPer, 8, 38) * rng.range(0.7, 1.1)));
    p.career.starts = Math.round(p.career.apps * 0.8);
    p.career.minutes = p.career.starts * 85;
    p.career.goals = Math.round(p.career.apps * goalRate * rng.range(0.6, 1.3) * (0.6 + ovr / 150));
    p.career.assists = Math.round(p.career.apps * goalRate * 0.6 * rng.range(0.6, 1.3));
    p.career.ratingSum = Math.round(p.career.apps * (6.3 + (ovr - 60) / 40) * 10) / 10;
  }
  if (ovr > 72 && !o.virtual) {
    const capRate = clamp((ovr - 72) / 14, 0, 1) * (country(o.nationality)?.strength ?? 70) / 90;
    p.intl.caps = Math.round(Math.max(0, o.age - 20) * 6 * capRate * rng.range(0.4, 1.1));
    p.intl.goals = Math.round(p.intl.caps * ({ ST: 0.35, RW: 0.2, LW: 0.2, AM: 0.18 } as Record<string, number>)[o.position] * rng.range(0.3, 1) || 0);
    if (p.intl.caps > 0) p.intl.tiedTo = o.nationality;
  }
  void BALANCE;
  void bestOverall;
  return p;
}
