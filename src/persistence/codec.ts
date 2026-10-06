/**
 * Lossless compact encoding of GameState for storage/export.
 * Player records dominate save size, so their fixed-shape sub-objects
 * (attributes, hidden traits, stat lines, appearance) become arrays.
 * decode(encode(s)) must deep-equal s — covered by tests.
 */
import { ALL_ATTRS, type Attributes, type GameState, type Hidden, type Player, type SeasonRecord, type StatLine } from "../engine/types";

const STAT_KEYS: (keyof StatLine)[] = [
  "apps", "starts", "minutes", "goals", "assists", "cleanSheets", "conceded", "yellow", "red", "ratingSum", "motm", "shots", "shotsOnTarget", "keyPasses", "tackles", "saves",
];
const HIDDEN_KEYS: (keyof Hidden)[] = [
  "potential", "consistency", "professionalism", "ambition", "loyalty", "injuryProneness", "adaptability", "bigMatch", "developmentRate", "peakAge",
];
const LOOK_KEYS = ["skin", "hair", "hairColor", "facial", "eyes"] as const;

const encStat = (s: StatLine): number[] => STAT_KEYS.map((k) => s[k]);
const decStat = (a: number[]): StatLine => Object.fromEntries(STAT_KEYS.map((k, i) => [k, a[i] ?? 0])) as unknown as StatLine;

type EncodedPlayer = Omit<Player, "attrs" | "hidden" | "season" | "career" | "history" | "look" | "month"> & {
  attrs: number[];
  hidden: number[];
  season: Record<string, number[]>;
  career: number[];
  history: EncodedHistory[];
  look: number[];
  month: number[];
};

type EncodedHistory = Omit<SeasonRecord, "stats" | "byCompetition"> & { stats: number[]; byCompetition?: Record<string, number[]> };

function encodePlayer(p: Player): EncodedPlayer {
  return {
    ...p,
    attrs: ALL_ATTRS.map((k) => p.attrs[k]),
    hidden: HIDDEN_KEYS.map((k) => p.hidden[k]),
    season: Object.fromEntries(Object.entries(p.season).map(([k, s]) => [k, encStat(s)])),
    career: encStat(p.career),
    history: p.history.map((h) => ({
      ...h,
      stats: encStat(h.stats),
      byCompetition: h.byCompetition ? Object.fromEntries(Object.entries(h.byCompetition).map(([k, s]) => [k, encStat(s)])) : undefined,
    })),
    look: LOOK_KEYS.map((k) => p.look[k]),
    month: [p.month.apps, p.month.ratingSum, p.month.goals, p.month.assists],
  };
}

function decodePlayer(e: EncodedPlayer): Player {
  const p: Player = {
    ...e,
    attrs: Object.fromEntries(ALL_ATTRS.map((k, i) => [k, e.attrs[i]])) as Attributes,
    hidden: Object.fromEntries(HIDDEN_KEYS.map((k, i) => [k, e.hidden[i]])) as unknown as Hidden,
    season: Object.fromEntries(Object.entries(e.season).map(([k, a]) => [k, decStat(a)])),
    career: decStat(e.career),
    history: e.history.map((h) => {
      const rec: SeasonRecord = { ...h, stats: decStat(h.stats), byCompetition: undefined };
      if (h.byCompetition) rec.byCompetition = Object.fromEntries(Object.entries(h.byCompetition).map(([k, a]) => [k, decStat(a)]));
      else delete rec.byCompetition;
      return rec;
    }),
    look: Object.fromEntries(LOOK_KEYS.map((k, i) => [k, e.look[i]])) as unknown as Player["look"],
    month: { apps: e.month[0], ratingSum: e.month[1], goals: e.month[2], assists: e.month[3] },
  };
  return p;
}

export interface EncodedState extends Omit<GameState, "players"> {
  players: EncodedPlayer[];
  __codec: 1;
}

export function encodeState(state: GameState): EncodedState {
  const { players, ...rest } = state;
  return { ...rest, players: Object.values(players).map(encodePlayer), __codec: 1 as const };
}

export function decodeState(enc: EncodedState): GameState {
  const { players, __codec, ...rest } = enc;
  void __codec;
  const map: Record<string, Player> = {};
  for (const e of players) {
    const p = decodePlayer(e);
    map[p.id] = p;
  }
  return { ...(rest as Omit<GameState, "players">), players: map };
}

export function isEncoded(x: unknown): x is EncodedState {
  return !!x && typeof x === "object" && (x as { __codec?: number }).__codec === 1;
}
