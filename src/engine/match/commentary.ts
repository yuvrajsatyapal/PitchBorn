/**
 * Commentary variety. Lines are chosen by hashing the fixture seed, the minute and a running counter, never by drawing
 * from the match RNG, so adding or changing a line can never change a result. Local phrasing follows the country of the
 * competition (or the home club), and weather lines follow the conditions.
 */
import type { MatchConditions } from "../types";

export interface CommentaryContext {
  /** Something stable per fixture (its id). */
  seed: string;
  /** Country code of the league or cup, when it has one. */
  country?: string;
  conditions?: MatchConditions;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickLine<T>(lines: readonly T[], key: string): T {
  return lines[hash(key) % lines.length];
}

type Region = "en" | "es" | "pt" | "de" | "it" | "fr" | "nl" | "us";
const REGION: Record<string, Region> = {
  ENG: "en", SCO: "en", WAL: "en", NIR: "en", IRL: "en", AUS: "en",
  ESP: "es", ARG: "es", MEX: "es", URU: "es", COL: "es",
  POR: "pt", BRA: "pt",
  GER: "de", AUT: "de", SUI: "de",
  ITA: "it",
  FRA: "fr", BEL: "fr",
  NED: "nl",
  USA: "us", CAN: "us",
};
export const regionOf = (cc: string | undefined): Region => (cc && REGION[cc]) || "en";

/** A short local cry after a goal. */
const GOAL_CRIES: Record<Region, readonly string[]> = {
  en: ["What a moment!", "Get in!", "The place erupts!", "Cue the bedlam!", "Back of the net!", "They're bouncing in the stands!"],
  es: ["¡Gooooool!", "¡Qué golazo!", "¡Golazo!", "The stadium shakes: ¡gol!", "¡Vamos! The stands are on their feet!"],
  pt: ["Gooooool!", "Golaço!", "Que golaço!", "The torcida go wild!", "Uma pintura!"],
  de: ["Tor! Tor! Tor!", "Was für ein Tor!", "The Kurve is jumping!", "Ein Traumtor!"],
  it: ["Gol! Gol! Gol!", "Che gol!", "The curva explodes!", "Un gol fantastico!"],
  fr: ["But ! But !", "Quel but !", "Le stade explose !", "Magnifique !"],
  nl: ["Doelpunt!", "Wat een goal!", "The Vak is bouncing!", "Prachtig!"],
  us: ["GOOOAL!", "What a finish!", "The supporters' section goes wild!", "Unbelievable!"],
};

const BIG_MISS: readonly string[] = [
  "a huge chance wasted!",
  "how has that stayed out?",
  "that one will haunt them.",
  "the manager can't believe it.",
  "agonising — it should have been a goal.",
  "the crowd hold their heads in their hands.",
];
const MISS: readonly string[] = ["wide of the target.", "over the bar.", "dragged wide.", "into the stands.", "past the post.", "high and wide."];
const SAVE: readonly string[] = ["saves!", "gets down well to save!", "keeps it out!", "tips it round the post!", "smothers it!", "beats it away!"];
const WOODWORK: readonly string[] = ["off the woodwork!", "rattles the crossbar!", "smacks the post!", "clips the bar and away!"];

/** Weather colour during play: once in each half, only when conditions are out of the ordinary. */
const WEATHER_PLAY: Record<string, readonly string[]> = {
  rain: ["The rain keeps coming and the ball is skidding off the turf.", "A slick surface: every first touch is an adventure.", "Players are struggling to stay upright in the wet."],
  "heavy-rain": ["Standing water now in one corner: the ball just stops dead.", "Absolutely teeming down. Proper conditions for a battle.", "Sliding tackles are going a long way on this surface."],
  snow: ["The snow is settling again: an orange ball would help.", "Breath steaming in the floodlights, snow swirling around the box.", "Footing is treacherous out there."],
  heat: ["The pace has dropped in this heat.", "Players are seeking the shade at every stoppage.", "You can see the heat in their legs now."],
  wind: ["Another clearance caught by the wind and carried out of play.", "The wind is doing strange things to the long balls.", "A gust holds the ball up: the keeper has to adjust."],
  heavy: ["The middle of the pitch is a mud bath now.", "Every pass on the floor is getting stuck in the turf."],
  frozen: ["Studs barely grip on this frozen surface.", "The ball bobbles across the icy pitch."],
};

/** Local colour for a quiet spell (one line per half at most, in detailed matches). */
const LOCAL_COLOUR: Record<Region, readonly string[]> = {
  en: ["A wall of noise from the home end.", "The away fans are in good voice.", "A typically end-to-end spell."],
  es: ["The stands are whistling every touch of the visitors.", "Patient, possession football: toque, toque, toque.", "The bombo drums keep the rhythm."],
  pt: ["The drums never stop in this stadium.", "A samba rhythm from the stands.", "Flags waving all around the ground."],
  de: ["The terrace is a yellow wall of noise.", "Gegenpressing at its finest.", "The crowd demand more urgency."],
  it: ["Flares and flags in the curva.", "Tactical, cagey football: very Italian.", "The tifosi want a goal."],
  fr: ["The ultras unfurl a huge banner.", "The tempo drops as both sides take stock.", "Allez! The home crowd urge them on."],
  nl: ["Total football flowing from the hosts.", "Quick combinations down the flank.", "A sea of colour behind the goal."],
  us: ["The supporters' section keeps the chants going.", "End-to-end action now.", "Smoke from the north end drifts across the pitch."],
};

export class Commentary {
  private n = 0;
  constructor(private ctx: CommentaryContext) {}
  private key(tag: string, minute: number) {
    return `${this.ctx.seed}:${tag}:${minute}:${this.n++}`;
  }
  goalCry(minute: number): string {
    return pickLine(GOAL_CRIES[regionOf(this.ctx.country)], this.key("goal", minute));
  }
  miss(minute: number, big: boolean): string {
    return pickLine(big ? BIG_MISS : MISS, this.key("miss", minute));
  }
  save(minute: number): string {
    return pickLine(SAVE, this.key("save", minute));
  }
  woodwork(minute: number): string {
    return pickLine(WOODWORK, this.key("wood", minute));
  }
  /** A line for minute 25 and 70 of a detailed match, or null. */
  ambient(minute: number): string | null {
    const c = this.ctx.conditions;
    if (c && !c.roof) {
      const pool = c.pitch === "frozen" ? WEATHER_PLAY.frozen : c.weather !== "clear" ? WEATHER_PLAY[c.weather] : c.pitch === "heavy" ? WEATHER_PLAY.heavy : undefined;
      if (pool) return pickLine(pool, this.key("wx", minute));
    }
    const local = LOCAL_COLOUR[regionOf(this.ctx.country)];
    // Not every match needs it: about half get a line of local colour.
    return hash(`${this.ctx.seed}:colour:${minute}`) % 2 === 0 ? pickLine(local, this.key("colour", minute)) : null;
  }
}
