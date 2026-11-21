/** How conditions are named and explained to the player. */
import type { MatchConditions, PitchKind, WeatherKind } from "../types";

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  clear: "Clear",
  rain: "Rain",
  "heavy-rain": "Heavy rain",
  snow: "Snow",
  heat: "Heat",
  wind: "Strong wind",
};

export const WEATHER_ICON: Record<WeatherKind, string> = {
  clear: "☀️",
  rain: "🌦️",
  "heavy-rain": "🌧️",
  snow: "❄️",
  heat: "🔥",
  wind: "💨",
};

export const PITCH_LABEL: Record<PitchKind, string> = {
  good: "Good pitch",
  heavy: "Heavy pitch",
  frozen: "Frozen pitch",
  dry: "Dry pitch",
};

/** A short, practical line about what the conditions will do to the game. */
export function conditionsNote(c: MatchConditions): string {
  if (c.pitch === "frozen") return "Rock-hard, icy surface: footing, touch and tempo will suffer, and tackles hurt more.";
  if (c.weather === "snow") return "Snow falling: the ball holds up and the game slows down.";
  if (c.weather === "heavy-rain") return "Heavy rain: the slick surface may make control difficult. Strong, balanced players cope best.";
  if (c.pitch === "heavy") return "A heavy, cut-up pitch: tiring underfoot, harder to keep the ball, a little more injury risk.";
  if (c.weather === "rain") return "Rain on the surface: the ball skids, so first touches need care.";
  if (c.weather === "wind") return "Gusting wind: crosses, long shots and goal kicks will be hard to judge.";
  if (c.weather === "heat") return c.tempC >= 33 ? "Fierce heat: legs will go early. Stamina is gold today." : "A hot day: expect tired legs late on. Stamina matters.";
  if (c.pitch === "dry") return "Fast, dry surface: perfect for passing football.";
  return "Ideal conditions for football.";
}

/** "🌧️ Heavy rain · 9°C · Heavy pitch" */
export function conditionsLine(c: MatchConditions): string {
  return `${WEATHER_ICON[c.weather]} ${WEATHER_LABEL[c.weather]} · ${Math.round(c.tempC)}°C · ${PITCH_LABEL[c.pitch]}`;
}

/** Whether the conditions are out of the ordinary enough to talk about. */
export function isAdverse(c: MatchConditions | undefined): boolean {
  return !!c && (c.weather !== "clear" || c.pitch === "heavy" || c.pitch === "frozen");
}
