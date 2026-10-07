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

/** Traits are stored as one short string per player ("id:xp:since;id:xp:since") to keep saves small. */
const encTraits = (t: Player["traits"]): string | undefined => (t ? t.map((x) => `${x.id}:${Math.round(x.xp * 10) / 10}:${x.since}`).join(";") : undefined);
const decTraits = (s: string | undefined): Player["traits"] =>
  s === undefined ? undefined : s === "" ? [] : s.split(";").map((part) => {
    const [id, xp, since] = part.split(":");
    return { id, xp: Number(xp), since: Number(since) };
  });

type EncodedPlayer = Omit<Player, "attrs" | "hidden" | "season" | "career" | "history" | "look" | "month" | "traits"> & {
  tr?: string;
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
  const { traits, ...rest } = p;
  return {
    ...rest,
    tr: encTraits(traits),
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
  const { tr, ...restE } = e;
  const p: Player = {
    ...restE,
    traits: decTraits(tr),
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
  if (!p.traits) delete p.traits;
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
