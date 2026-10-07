/**
 * Hair designs for the improved renderer. Each design picks a technique for its hair type and gives it its own
 * shape; the metadata follows the long-term library format (only the proof-of-concept styles are defined so far).
 */
import { coilyHair, type CoilyDesign } from "./coily";
import type { HairArt, HairInput } from "./core";
import { backMass, flowHair, type FlowDesign } from "./flow";
import { locsHair, type LocsDesign } from "./locs";
import { crescentHair, cropHair, shavedHair, type CropDesign } from "./short";

export type { HairArt, HairInput } from "./core";
export { HAIRLINES, hairline, type HairlineKind } from "./core";

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
}

const meta = (m: Omit<HairStyleMeta, "supportsSecondaryColor" | "supportsHeadband" | "supportsRecedingHairline"> & Partial<HairStyleMeta>): HairStyleMeta => ({
  supportsSecondaryColor: false,
  supportsHeadband: false,
  supportsRecedingHairline: true,
  ...m,
});

const TEXTURED_CROP: CropDesign = {
  kind: "straight",
  top: 12,
  side: 1,
  sides: "taper",
  drop: 4,
  // One large lock, a couple of small ones, and gaps where the edge lifts: never evenly spaced teeth.
  locks: [
    { u: 0.12, w: 12, len: 6, lean: -2 },
    { u: 0.27, w: 16, len: 14, lean: -5, bend: -1.5 },
    { u: 0.4, w: 10, len: 8, lean: -3 },
    { u: 0.49, w: 18, len: 21, lean: -6, bend: -2 },
    { u: 0.67, w: 14, len: 12, lean: -4, bend: 1 },
    { u: 0.84, w: 10, len: 5, lean: -1.5 },
  ],
  lifts: [
    { u: 0.58, w: 0.06, a: 3 },
    { u: 0.92, w: 0.07, a: 2.5 },
  ],
  tufts: [
    { u: 0.17, w: 0.05, a: 2.5, lean: -2 },
    { u: 0.29, w: 0.07, a: 5, lean: -3 },
    { u: 0.51, w: 0.08, a: 6, lean: 2 },
    { u: 0.64, w: 0.05, a: 3, lean: 2 },
    { u: 0.76, w: 0.07, a: 4.5, lean: 3 },
  ],
};

const MULLET_TOP: CropDesign = {
  kind: "straight",
  top: 11,
  side: 1.5,
  sides: "taper",
  drop: 3,
  locks: [
    { u: 0.18, w: 13, len: 8, lean: -2 },
    { u: 0.36, w: 15, len: 12, lean: -3, bend: -1 },
    { u: 0.55, w: 13, len: 9, lean: 2 },
    { u: 0.74, w: 15, len: 11, lean: 3, bend: 1 },
  ],
  lifts: [{ u: 0.46, w: 0.06, a: 2.5 }],
  tufts: [
    { u: 0.22, w: 0.06, a: 3, lean: -2 },
    { u: 0.45, w: 0.07, a: 4, lean: -1 },
    { u: 0.7, w: 0.06, a: 3.5, lean: 2 },
  ],
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
  groups: 5,
  curls: 9,
  curlR: [1.8, 2.8],
};

const CURLY_FADE: CoilyDesign = {
  kind: "straight",
  shape: "cap",
  top: 18,
  side: 4,
  sides: "fade",
  edge: { spacing: [9, 17], amp: [2.5, 5.5], big: 0.25 },
  // A few curl groups hang over the forehead, different sizes, with gaps between: not a scalloped line.
  fringe: {
    spacing: [5, 10],
    amp: [0.6, 1.8],
    drop: 2,
    tips: [
      { u: 0.22, w: 0.09, a: 6, lean: -1 },
      { u: 0.4, w: 0.12, a: 10, lean: -2 },
      { u: 0.63, w: 0.08, a: 5, lean: 1 },
      { u: 0.8, w: 0.1, a: 7.5, lean: 2 },
    ],
  },
  cluster: { r: [2.8, 4.4], lobes: 3, squash: 0.75 },
  groups: 4,
  curls: 10,
  curlR: [1.8, 3],
};

const MEDIUM_DREADS: LocsDesign = { kind: "irregular", end: 322, fringe: 2, side: 3, back: 4, w: [9, 12.5] };

const LONG_FLOW: FlowDesign = {
  kind: "straight",
  part: 6,
  top: 10,
  side: 8,
  end: () => 338,
  cover: 5,
  arch: 0.25,
  flare: 0.12,
  wave: 1.5,
  tips: 4,
  tipLen: [8, 20],
  back: { from: (f) => f.eyeY - 4, end: () => 352, spread: 6, tips: 5 },
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
  wave: 0,
  tips: 2,
  tipLen: [4, 9],
  back: { from: (f) => f.eyeY, end: (f) => f.jawY + 10, spread: 2, tips: 3 },
};

export const HAIR_LIBRARY: readonly (HairStyleMeta & { draw: (i: HairInput) => HairArt })[] = [
  { ...meta({ id: "shaved", name: "Shaved", category: "shaved", hairType: "none", length: "shaved", rarity: "common", minimumAge: 16, maximumAge: 45, eraWeight: { retro: 0.5, modern: 1 } }), draw: (i) => shavedHair(i) },
  { ...meta({ id: "textured-crop", name: "Short Textured", category: "crop", hairType: "straight", length: "short", rarity: "common", minimumAge: 16, maximumAge: 40, eraWeight: { retro: 0.4, modern: 1 }, supportsSecondaryColor: true }), draw: (i) => cropHair(i, TEXTURED_CROP) },
  { ...meta({ id: "medium-afro", name: "Medium Afro", category: "afro", hairType: "coily", length: "medium", rarity: "uncommon", minimumAge: 16, maximumAge: 40, eraWeight: { retro: 1, modern: 0.7 }, supportsHeadband: true }), draw: (i) => coilyHair(i, MEDIUM_AFRO) },
  { ...meta({ id: "medium-dreads", name: "Medium Dreads", category: "locs", hairType: "locs", length: "long", rarity: "uncommon", minimumAge: 17, maximumAge: 40, eraWeight: { retro: 0.8, modern: 1 }, supportsSecondaryColor: true, supportsHeadband: true }), draw: (i) => locsHair(i, MEDIUM_DREADS) },
  { ...meta({ id: "long-flow", name: "Long Flow", category: "long", hairType: "straight", length: "long", rarity: "uncommon", minimumAge: 16, maximumAge: 38, eraWeight: { retro: 1, modern: 0.6 }, supportsHeadband: true }), draw: (i) => flowHair(i, LONG_FLOW) },
  { ...meta({ id: "classic-curtains", name: "Classic Curtains", category: "retro", hairType: "straight", length: "medium", rarity: "uncommon", minimumAge: 16, maximumAge: 36, eraWeight: { retro: 1, modern: 0.4 } }), draw: (i) => flowHair(i, CLASSIC_CURTAINS) },
  { ...meta({ id: "curly-fade", name: "Curly Fade", category: "fade", hairType: "curly", length: "short", rarity: "common", minimumAge: 16, maximumAge: 36, eraWeight: { retro: 0.3, modern: 1 }, supportsSecondaryColor: true }), draw: (i) => coilyHair(i, CURLY_FADE) },
  { ...meta({ id: "brazilian-crescent", name: "Brazilian Crescent", category: "iconic", hairType: "straight", length: "shaved", rarity: "legendary", minimumAge: 18, maximumAge: 34, eraWeight: { retro: 1, modern: 0.3 }, supportsRecedingHairline: false }), draw: (i) => crescentHair(i) },
  {
    ...meta({ id: "classic-mullet", name: "Classic Mullet", category: "mullet", hairType: "wavy", length: "medium", rarity: "rare", minimumAge: 17, maximumAge: 38, eraWeight: { retro: 1, modern: 0.3 }, supportsHeadband: true }),
    draw: (i) => {
      const top = cropHair(i, MULLET_TOP);
      return { ...top, back: backMass(i, { from: (f) => f.ear.top + 2, end: () => 328, spread: 22, tips: 4, tone: 0.25 }, 6) };
    },
  },
];

const BY_ID = new Map(HAIR_LIBRARY.map((h) => [h.id, h]));

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
};
