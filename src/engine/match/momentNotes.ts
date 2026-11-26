/**
 * Why a key-moment option is harder (or easier) right now: the weather and pitch, and tired legs. The odds already reflect it
 * (weather lowers the attributes the option relies on, fatigue lowers the player's level); this only says so, in a few words.
 * Pure: reads the conditions, the minute and the player's energy; draws nothing.
 */
import type { MatchConditions } from "../types";

const TOUCH = ["First Touch", "Dribbling", "Technique", "Passing", "Agility", "Balance"];
const AIR = ["Crossing", "Long Shots", "Kicking"];
const LEGS = ["Pace", "Acceleration", "Agility", "Stamina", "Work Rate"];

export function momentNote(skills: readonly string[] | undefined, c: MatchConditions | undefined, minute: number, energy: number): string | undefined {
  const s = skills ?? [];
  const has = (list: string[]) => s.some((k) => list.includes(k));
  if (c && !c.roof) {
    if ((c.weather === "rain" || c.weather === "heavy-rain" || c.weather === "snow" || c.pitch === "heavy" || c.pitch === "frozen") && has(TOUCH)) {
      return c.pitch === "frozen" ? "❄️ Hard to keep your feet on the frozen pitch" : c.weather === "snow" ? "❄️ The snow holds the ball up" : c.pitch === "heavy" ? "🟫 The heavy pitch makes this harder" : "🌧️ The slick surface makes this harder";
    }
    if (c.weather === "wind" && has(AIR)) return "💨 The wind will play with the ball";
    if (c.weather === "heat" && minute >= 60 && has(LEGS)) return "🔥 Legs are heavy in this heat";
  }
  if (energy < 45 && has(LEGS)) return "😮‍💨 You're tiring: less burst than usual";
  if (c?.pitch === "dry" && has(["Passing", "Technique"])) return "✨ The quick, dry surface suits a passing game";
  return undefined;
}
