/**
 * Hair designs for the improved renderer. Each design picks a technique for its hair type and gives it its own
 * shape; the metadata follows the long-term library format (only the proof-of-concept styles are defined so far).
 */
import { coilyHair, type CoilyDesign } from "./coily";
import type { HairArt, HairInput } from "./core";
import { flowHair, type FlowDesign } from "./flow";
import { fauxHawkHair, headbandCurlsHair, ponytailHair } from "./iconic";
import { locsHair, type LocsDesign } from "./locs";
import { crescentHair, cropHair, shavedHair, type CropDesign } from "./short";

export type { HairArt, HairInput } from "./core";
export { HAIRLINES, extentOf, hairline, type HairlineKind } from "./core";

export interface HairStyleMeta {
  id: string;
  /** Generic name: never a real player's. */
  name: string;
  category: "shaved" | "crop" | "fade" | "curly" | "afro" | "locs" | "long" | "retro" | "mullet" | "iconic";
  hairType: "none" | "straight" | "wavy" | "curly" | "coily" | "locs";
  length: "shaved" | "short" | "medium" | "long";
  /** Roughly 70 / 20 / 8 / 2 across the library. */
  rarity: "common" | "uncommon" | "rare" | "legendary";
  minimumAge: number;
  maximumAge: number;
  eraWeight: { retro: number; modern: number };
  supportsSecondaryColor: boolean;
  supportsHeadband: boolean;
  supportsRecedingHairline: boolean;
  /** How the hair treats the ears (an ear stud is only drawn where the ear shows), and whether it brings its own band. */
  ears: "visible" | "partial" | "covered";
  supportsEarrings: boolean;
  ownHeadband: boolean;
}

type Defaults = "supportsSecondaryColor" | "supportsHeadband" | "supportsRecedingHairline" | "ears" | "supportsEarrings" | "ownHeadband";
const meta = (m: Omit<HairStyleMeta, Defaults> & Partial<HairStyleMeta>): HairStyleMeta => ({
  supportsSecondaryColor: false,
  supportsHeadband: false,
  supportsRecedingHairline: true,
  ears: "visible",
  ownHeadband: false,
  ...m,
  supportsEarrings: m.supportsEarrings ?? (m.ears ?? "visible") !== "covered",
});

const TEXTURED_CROP: CropDesign = {
  kind: "straight",
  top: 12,
  side: 1,
  sides: "taper",
  drop: 4,
  // Wide locks that overlap into one fringe: one long, one medium, short ones at the sides, one small lift showing
  // forehead. Tips curve on; nothing is evenly spaced.
  locks: [
    { u: 0.13, w: 17, len: 7, lean: -2 },
    { u: 0.3, w: 20, len: 14, lean: -5, bend: -1.5 },
    { u: 0.49, w: 22, len: 21, lean: -6, bend: -2 },
    { u: 0.7, w: 18, len: 11, lean: -3.5, bend: 1 },
    { u: 0.87, w: 14, len: 6, lean: -1.5 },
  ],
  lifts: [{ u: 0.62, w: 0.05, a: 2.5 }],
  tufts: [
    { u: 0.17, w: 0.05, a: 2.5, lean: -2 },
    { u: 0.29, w: 0.07, a: 5, lean: -3 },
    { u: 0.51, w: 0.08, a: 6, lean: 2 },
    { u: 0.64, w: 0.05, a: 3, lean: 2 },
    { u: 0.76, w: 0.07, a: 4.5, lean: 3 },
  ],
};

// A mullet: a short, feathered top swept back from the parting, sides kept above the ears, and a long back that
// flows down behind the neck onto the shoulders.
const CLASSIC_MULLET: FlowDesign = {
  kind: "straight",
  part: -5,
  top: 12,
  side: 4,
  end: (f) => f.ear.top + 4,
  cover: 1,
  arch: 0.3,
  flare: 0.05,
  wave: 0.8,
  locks: 3,
  reach: [0.82, 1],
  strands: 0,
  loose: false,
  flick: 0.18,
  // The long back starts below the ears, so the short sides show between it and the top.
  back: { from: (f) => f.ear.bot - 6, end: () => 332, spread: 20, masses: 2 },
};

const MEDIUM_AFRO: CoilyDesign = {
  kind: "rounded",
  shape: "round",
  top: 32,
  side: 22,
  sides: "full",
  edge: { spacing: [7, 14], amp: [1.2, 3.2], big: 0.18 },
  fringe: { spacing: [6, 11], amp: [0.6, 1.8] },
  cluster: { r: [3.6, 6], lobes: 3, squash: 0.8 },
  groups: 3,
  curls: 5,
  curlR: [1.8, 2.8],
};

const CURLY_FADE: CoilyDesign = {
  kind: "straight",
  shape: "cap",
  top: 18,
  side: 2.5,
  sides: "fade",
  edge: { spacing: [9, 17], amp: [2.5, 5.5], big: 0.25 },
  // Three curl groups of different size hang over the forehead with gaps between; the rest of the edge is calm.
  fringe: {
    spacing: [10, 16],
    amp: [0.3, 1],
    drop: 2,
    tips: [
      { u: 0.24, w: 0.1, a: 6, lean: -1 },
      { u: 0.44, w: 0.13, a: 10, lean: -2 },
      { u: 0.76, w: 0.1, a: 7, lean: 2 },
    ],
  },
  cluster: { r: [2.8, 4.4], lobes: 3, squash: 0.75 },
  groups: 3,
  curls: 6,
  curlR: [1.8, 3],
};

// Thirteen major locks: 2 + 2 behind, 3 + 4 framing the face (the extra one on a seeded side), 2 over the forehead.
const MEDIUM_DREADS: LocsDesign = { kind: "irregular", end: 324, fringe: 2, side: 3, back: 2, w: [12, 16.5] };

// Fewer, much thicker locks than Medium Dreads, from a big crown: some arch out over it, some push out wide beside
// the face, one hangs in front of a shoulder, the rest fall behind.
const DUTCH_DREADS: LocsDesign = { kind: "irregular", end: 318, fringe: 2, side: 2, back: 2, w: [19, 26], cap: { top: 24, side: 14 }, spread: 30, forward: 1, rise: 1 };

// A cloud far bigger than Medium Afro: it surrounds the whole head, covers the ears and continues behind the jaw.
// Large lobes, a few big light groups, very few curls. Ends in the second colour (golden by default) when chosen.
const LION_AFRO: CoilyDesign = {
  kind: "rounded",
  shape: "round",
  top: 34,
  side: 47,
  sides: "full",
  edge: { spacing: [13, 24], amp: [3, 6.5], big: 0.35 },
  fringe: { spacing: [9, 15], amp: [1, 2.6] },
  cluster: { r: [5, 8], lobes: 3, squash: 0.8 },
  groups: 5,
  curls: 4,
  curlR: [2.2, 3.4],
  mane: { low: (f) => f.ear.bot - 4, bottom: (f) => f.jawY + 24 },
  rim: true,
};

const LONG_FLOW: FlowDesign = {
  kind: "straight",
  part: 7,
  top: 10,
  side: 8,
  end: () => 334,
  cover: 5,
  arch: 0.25,
  flare: 0.12,
  wave: 4,
  locks: 4,
  reach: [0.8, 1],
  strands: 0,
  loose: true,
  flick: 0.08,
  back: { from: (f) => f.eyeY - 4, end: () => 352, spread: 6, masses: 2 },
};

const CLASSIC_CURTAINS: FlowDesign = {
  kind: "straight",
  part: 0,
  top: 10,
  side: 6.5,
  end: (f) => f.mouthY + 4,
  cover: 3,
  arch: 0.75,
  flare: 0.07,
  wave: 1.5,
  locks: 3,
  reach: [0.78, 1],
  strands: 2,
  loose: false,
  flick: 0.14,
  back: { from: (f) => f.eyeY, end: (f) => f.jawY + 10, spread: 2, masses: 1 },
};

export const HAIR_LIBRARY: readonly (HairStyleMeta & { draw: (i: HairInput) => HairArt })[] = [
  { ...meta({ id: "shaved", name: "Shaved", category: "shaved", hairType: "none", length: "shaved", rarity: "common", minimumAge: 16, maximumAge: 45, eraWeight: { retro: 0.5, modern: 1 } }), draw: (i) => shavedHair(i) },
  { ...meta({ id: "textured-crop", name: "Short Textured", category: "crop", hairType: "straight", length: "short", rarity: "common", minimumAge: 16, maximumAge: 40, eraWeight: { retro: 0.4, modern: 1 }, supportsSecondaryColor: true }), draw: (i) => cropHair(i, TEXTURED_CROP) },
  { ...meta({ id: "medium-afro", name: "Medium Afro", category: "afro", hairType: "coily", length: "medium", rarity: "uncommon", minimumAge: 16, maximumAge: 40, eraWeight: { retro: 1, modern: 0.7 }, supportsHeadband: true, ears: "partial" }), draw: (i) => coilyHair(i, MEDIUM_AFRO) },
  { ...meta({ id: "medium-dreads", name: "Medium Dreads", category: "locs", hairType: "locs", length: "long", rarity: "uncommon", minimumAge: 17, maximumAge: 40, eraWeight: { retro: 0.8, modern: 1 }, supportsSecondaryColor: true, supportsHeadband: true, ears: "covered" }), draw: (i) => locsHair(i, MEDIUM_DREADS) },
  { ...meta({ id: "long-flow", name: "Long Flow", category: "long", hairType: "straight", length: "long", rarity: "uncommon", minimumAge: 16, maximumAge: 38, eraWeight: { retro: 1, modern: 0.6 }, supportsHeadband: true, ears: "covered" }), draw: (i) => flowHair(i, LONG_FLOW) },
  { ...meta({ id: "classic-curtains", name: "Classic Curtains", category: "retro", hairType: "straight", length: "medium", rarity: "uncommon", minimumAge: 16, maximumAge: 36, eraWeight: { retro: 1, modern: 0.4 }, ears: "covered" }), draw: (i) => flowHair(i, CLASSIC_CURTAINS) },
  { ...meta({ id: "curly-fade", name: "Curly Fade", category: "fade", hairType: "curly", length: "short", rarity: "common", minimumAge: 16, maximumAge: 36, eraWeight: { retro: 0.3, modern: 1 }, supportsSecondaryColor: true }), draw: (i) => coilyHair(i, CURLY_FADE) },
  { ...meta({ id: "brazilian-crescent", name: "Brazilian Crescent", category: "iconic", hairType: "straight", length: "shaved", rarity: "legendary", minimumAge: 18, maximumAge: 34, eraWeight: { retro: 1, modern: 0.3 }, supportsRecedingHairline: false }), draw: (i) => crescentHair(i) },
  {
    ...meta({ id: "classic-mullet", name: "Classic Mullet", category: "mullet", hairType: "wavy", length: "medium", rarity: "rare", minimumAge: 17, maximumAge: 38, eraWeight: { retro: 1, modern: 0.3 }, supportsHeadband: true }),
    draw: (i) => flowHair(i, CLASSIC_MULLET),
  },
  // Iconic: rare across the squad, each with a silhouette of its own.
  { ...meta({ id: "frosted-faux-hawk", name: "Frosted Faux Hawk", category: "iconic", hairType: "straight", length: "short", rarity: "legendary", minimumAge: 17, maximumAge: 34, eraWeight: { retro: 0.6, modern: 1 }, supportsSecondaryColor: true, supportsHeadband: true }), draw: (i) => fauxHawkHair(i) },
  { ...meta({ id: "long-headband-curls", name: "Long Headband Curls", category: "iconic", hairType: "curly", length: "long", rarity: "legendary", minimumAge: 17, maximumAge: 36, eraWeight: { retro: 1, modern: 0.6 }, ears: "partial", ownHeadband: true }), draw: (i) => headbandCurlsHair(i) },
  { ...meta({ id: "lion-afro", name: "Lion Afro", category: "iconic", hairType: "coily", length: "long", rarity: "legendary", minimumAge: 17, maximumAge: 36, eraWeight: { retro: 1, modern: 0.7 }, supportsSecondaryColor: true, ears: "covered" }), draw: (i) => coilyHair(i, LION_AFRO) },
  { ...meta({ id: "divine-ponytail", name: "Divine Ponytail", category: "iconic", hairType: "straight", length: "long", rarity: "legendary", minimumAge: 18, maximumAge: 38, eraWeight: { retro: 0.8, modern: 0.8 }, supportsRecedingHairline: true }), draw: (i) => ponytailHair(i) },
  { ...meta({ id: "dutch-dreads", name: "Dutch Dreads", category: "iconic", hairType: "locs", length: "long", rarity: "legendary", minimumAge: 18, maximumAge: 36, eraWeight: { retro: 1, modern: 0.5 }, supportsSecondaryColor: true, supportsHeadband: true, ears: "covered" }), draw: (i) => locsHair(i, DUTCH_DREADS) },
];

const BY_ID = new Map(HAIR_LIBRARY.map((h) => [h.id, h]));

/** A design's metadata (undefined for ids without a new design). */
export const hairMeta = (id: string): HairStyleMeta | undefined => BY_ID.get(id);

/** New-technique hair for a design id; null means "use the current renderer". */
export function drawHair(id: string, i: HairInput): HairArt | null {
  return BY_ID.get(id)?.draw(i) ?? null;
}

/** Existing hair option index -> the design that now draws it (others still use the current renderer). */
export const POC_IDS: Partial<Record<number, string>> = {
  0: "shaved",
  7: "textured-crop",
  8: "curly-fade",
  10: "medium-afro",
  17: "medium-dreads",
  23: "long-flow",
  24: "classic-curtains",
  29: "classic-mullet",
  39: "brazilian-crescent",
  40: "frosted-faux-hawk",
  41: "long-headband-curls",
  42: "lion-afro",
  43: "divine-ponytail",
  44: "dutch-dreads",
};
