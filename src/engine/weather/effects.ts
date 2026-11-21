/**
 * What conditions do to a match, as small modifiers the engine applies to systems it already has. Pure. Clear weather
 * on a good (or dry) pitch has no effect at all, so `weatherFx` returns null and the engine takes its normal path.
 */
import { BALANCE } from "../balance";
import { clamp } from "../rng";
import type { AttrKey, Attributes, MatchConditions } from "../types";

const W = BALANCE.weather;

export const TECH_ATTRS: readonly AttrKey[] = ["firstTouch", "passing", "dribbling", "technique"];
export const WIND_ATTRS: readonly AttrKey[] = ["crossing", "longShots", "kicking"];

export interface WeatherFx {
  /** Fraction off the technical attributes before physical relief (0 = none). */
  tech: number;
  /** Fraction off crossing, long shots and kicking. */
  wind: number;
  /** Energy drain multiplier before stamina relief (1 = none). */
  heatDrain: number;
  /** Fraction off attack strength. */
  tempo: number;
  /** Extra per-phase chance of a defensive mistake. */
  lapse: number;
  /** Injury chance multiplier. */
  injury: number;
}

/** How severe the heat is, 0 (just hot) to 1 (extreme). */
export function heatSeverity(c: MatchConditions): number {
  if (c.weather !== "heat") return 0;
  return clamp((c.tempC - W.heatC) / (W.heatMaxC - W.heatC), 0, 1);
}

export function weatherFx(c: MatchConditions | undefined): WeatherFx | null {
  if (!c) return null;
  const weatherTech = c.weather === "rain" ? W.tech.rain : c.weather === "heavy-rain" ? W.tech["heavy-rain"] : c.weather === "snow" ? W.tech.snow : 0;
  const pitchTech = c.pitch === "heavy" ? W.tech.heavyPitch : c.pitch === "frozen" ? W.tech.frozenPitch : 0;
  const wintry = c.weather === "snow" || c.pitch === "frozen";
  const fx: WeatherFx = {
    tech: Math.min(W.techCap, weatherTech + pitchTech),
    wind: c.weather === "wind" ? W.wind : 0,
    heatDrain: c.weather === "heat" ? W.heatDrain[0] + (W.heatDrain[1] - W.heatDrain[0]) * heatSeverity(c) : 1,
    tempo: wintry ? W.tempo : 0,
    lapse: wintry ? W.lapse : 0,
    injury: c.pitch === "frozen" ? W.injury.frozen : c.pitch === "heavy" ? W.injury.heavy : 1,
  };
  const none = fx.tech === 0 && fx.wind === 0 && fx.heatDrain === 1 && fx.tempo === 0 && fx.lapse === 0 && fx.injury === 1;
  return none ? null : fx;
}

/** 0-1: how much of a penalty a value in `range` takes away (0 below the range, 1 at the top of it). */
const relief = (v: number, range: readonly [number, number]) => clamp((v - range[0]) / (range[1] - range[0]), 0, 1);

/**
 * Per-attribute multipliers for one player, or null when the weather leaves his attributes alone. Strong, balanced
 * players keep their feet and the ball better on a bad surface.
 */
export function attrMultipliers(fx: WeatherFx | null, attrs: Attributes): Partial<Record<AttrKey, number>> | null {
  if (!fx || (fx.tech === 0 && fx.wind === 0)) return null;
  const out: Partial<Record<AttrKey, number>> = {};
  if (fx.tech > 0) {
    const sturdy = relief((attrs.strength + attrs.balance) / 2, W.physicalReliefRange);
    const cut = fx.tech * (1 - W.physicalRelief * sturdy);
    for (const k of TECH_ATTRS) out[k] = 1 - cut;
  }
  if (fx.wind > 0) for (const k of WIND_ATTRS) out[k] = (out[k] ?? 1) * (1 - fx.wind);
  return out;
}

/** Energy drain multiplier for one player in the heat: stamina takes away part of the extra drain. */
export function drainMultiplier(fx: WeatherFx | null, stamina: number): number {
  if (!fx || fx.heatDrain === 1) return 1;
  return 1 + (fx.heatDrain - 1) * (1 - W.staminaRelief * relief(stamina, W.staminaReliefRange));
}
