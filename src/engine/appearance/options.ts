/**
 * Appearance option tables. Everything the portrait renderer needs to know about a variant lives here as data,
 * so adding a hairstyle or a face shape never touches rendering logic.
 */

export interface Option {
  name: string;
}

// ------------------------------------------------------------------ colours

/** Light to dark. */
export const SKIN_TONES = ["#f8dfce", "#f1cdb0", "#e8b998", "#d9a07a", "#c68a60", "#b0724a", "#94593a", "#794530", "#5f3525", "#482819"] as const;
export const SKIN_NAMES = ["Porcelain", "Fair", "Light", "Warm beige", "Tan", "Caramel", "Bronze", "Brown", "Deep brown", "Ebony"] as const;

export const HAIR_COLORS = ["#16110d", "#2a1c14", "#3e281a", "#5b3a22", "#7d5632", "#a37a45", "#c9a45f", "#a9461f", "#7a2f1a", "#aeaeb0"] as const;
export const HAIR_COLOR_NAMES = ["Jet black", "Black brown", "Dark brown", "Chestnut", "Light brown", "Dark blond", "Blond", "Ginger", "Auburn", "Silver"] as const;

export const EYE_COLORS = ["#2a1a10", "#5a3a1e", "#7d6a2a", "#3d7a52", "#3f78b5", "#7d8a96"] as const;
export const EYE_COLOR_NAMES = ["Dark brown", "Brown", "Hazel", "Green", "Blue", "Grey"] as const;

export const INK = "#1b1712";

// ------------------------------------------------------------------ face shapes
// Half-width of the face (px, before scaling) at fractions of its height from the crown to the chin.
export const CONTOUR_T = [0, 0.08, 0.18, 0.32, 0.48, 0.62, 0.76, 0.88, 0.96, 1] as const;

export interface FaceShape extends Option {
  half: readonly number[];
  /** Relative height. */
  h: number;
  /** Outline curve tension: lower is more angular (square jaws), higher is rounder. */
  tension?: number;
  /** Cleft in the chin. */
  cleft?: boolean;
}

// Each shape is its own silhouette (temple, cheekbone, jaw angle, chin width and projection), not a rescaled oval.
export const FACE_SHAPES: readonly FaceShape[] = [
  { name: "Oval", half: [0, 30, 43, 49, 50, 47, 40, 30, 18, 10], h: 1 },
  { name: "Round", half: [0, 32, 46, 52, 54, 53, 48, 40, 28, 19], h: 0.94, tension: 0.6 },
  { name: "Square", half: [0, 30, 44, 50, 52, 52, 51, 48, 42, 33], h: 0.97, tension: 0.26 },
  { name: "Rectangular", half: [0, 29, 42, 48, 50, 50, 49, 47, 43, 36], h: 1.1, tension: 0.28 },
  { name: "Diamond", half: [0, 22, 34, 47, 54, 46, 33, 22, 12, 6], h: 1.02, tension: 0.4 },
  { name: "Narrow", half: [0, 25, 35, 40, 42, 40, 35, 27, 17, 9], h: 1.06 },
  { name: "Broad", half: [0, 35, 48, 54, 57, 56, 52, 46, 34, 24], h: 0.95, tension: 0.35 },
  { name: "Long", half: [0, 27, 38, 44, 45, 43, 37, 28, 17, 9], h: 1.13 },
  { name: "Heart", half: [0, 35, 47, 51, 49, 41, 30, 19, 11, 6], h: 1.02, tension: 0.45 },
  { name: "Strong jaw", half: [0, 29, 42, 48, 51, 52, 51, 48, 41, 30], h: 1.02, tension: 0.24, cleft: true },
  { name: "High cheekbones", half: [0, 25, 37, 50, 55, 46, 34, 24, 15, 9], h: 1.04, tension: 0.42 },
  { name: "Soft jaw", half: [0, 32, 45, 51, 52, 50, 45, 37, 27, 20], h: 0.98, tension: 0.62 },
];

// ------------------------------------------------------------------ hair

export type HairTexture = "straight" | "wavy" | "curly" | "coily";
export type HairEdge = "smooth" | "scallop" | "spiky" | "wavy" | "tuft";
export type Fringe = "none" | "straight" | "side" | "curtain" | "sweep" | "messy" | "quiff" | "caesar";
export type Strands = "none" | "locs" | "braids" | "twists" | "rows" | "bun" | "ponytail";

export interface HairStyle extends Option {
  texture: HairTexture;
  /** Height above the crown. */
  top: number;
  /** Extra width past the temples. */
  side: number;
  /** Hairline height at the centre of the forehead (y) and at the temples. */
  line: number;
  temple: number;
  /** Where the hair on the sides stops (y). */
  end: number;
  edge: HairEdge;
  fringe: Fringe;
  /** 0 none, 1 faded sides, 2 high fade, 3 skin fade. */
  fade: number;
  /** Hair behind the head: 0 none, 1 nape, 2 jaw, 3 shoulder, 4 long. */
  back: number;
  strands: Strands;
  /** 0-1: how solid the colour is (buzz cuts show the scalp). */
  density: number;
  part: -1 | 0 | 1;
  /** Square-ish crown (crew cut) rather than round. */
  flat?: boolean;
  /** Only the sides and back remain. */
  horseshoe?: boolean;
  sheen?: boolean;
}

const hs = (name: string, texture: HairTexture, p: Partial<Omit<HairStyle, "name" | "texture">>): HairStyle => ({
  name, texture, top: 10, side: 1, line: 72, temple: 84, end: 100, edge: "smooth", fringe: "none", fade: 0, back: 0, strands: "none", density: 1, part: 0, ...p,
});

export const HAIR_STYLES: readonly HairStyle[] = [
  hs("Shaved", "straight", { top: 0, side: 0, density: 0.22, end: 96, line: 70 }),
  hs("Buzz cut", "straight", { top: 3, side: 0.5, density: 0.55, end: 98, line: 68 }),
  hs("Crew cut", "straight", { top: 8, side: 1, flat: true, end: 98, line: 66, fade: 1 }),
  hs("Low fade", "straight", { top: 11, side: 1, end: 100, fade: 1, line: 66, fringe: "side", part: 1 }),
  hs("Mid fade", "straight", { top: 13, side: 1, end: 100, fade: 2, line: 64, fringe: "sweep", part: -1 }),
  hs("High fade", "straight", { top: 15, side: 0, end: 100, fade: 3, line: 62, fringe: "quiff" }),
  hs("Taper", "straight", { top: 12, side: 1, end: 102, fade: 1, line: 66, fringe: "straight" }),
  hs("Textured crop", "wavy", { top: 12, side: 2, edge: "spiky", fringe: "straight", line: 70, end: 100, fade: 1 }),
  hs("Curly crop", "curly", { top: 13, side: 3, edge: "scallop", fringe: "none", line: 68, end: 100, fade: 1 }),
  hs("Short afro", "coily", { top: 22, side: 10, edge: "scallop", line: 70, end: 104, fade: 1 }),
  hs("Medium afro", "coily", { top: 30, side: 21, edge: "scallop", line: 68, end: 108 }),
  hs("Big afro", "coily", { top: 38, side: 31, edge: "scallop", line: 66, end: 112 }),
  hs("Waves", "wavy", { top: 9, side: 1, end: 100, fade: 2, line: 66 }),
  hs("Twists", "coily", { top: 20, side: 3, edge: "scallop", strands: "twists", fade: 2, line: 70, end: 100 }),
  hs("Cornrows", "coily", { top: 3, side: 0.5, strands: "rows", end: 100, line: 70, density: 0.95 }),
  hs("Braids", "coily", { top: 6, side: 3, strands: "braids", back: 3, end: 120, line: 68 }),
  hs("Short braids", "coily", { top: 8, side: 2, strands: "braids", back: 1, end: 108, line: 68 }),
  hs("Dreadlocks", "coily", { top: 14, side: 6, strands: "locs", back: 4, end: 124, line: 66, edge: "scallop" }),
  hs("Short dreads", "coily", { top: 18, side: 5, strands: "locs", back: 1, end: 106, line: 68, edge: "scallop", fade: 1 }),
  hs("Medium curls", "curly", { top: 18, side: 9, edge: "scallop", end: 112, back: 1, line: 66, fringe: "sweep", part: 1 }),
  hs("Long curls", "curly", { top: 16, side: 11, edge: "scallop", end: 130, back: 3, line: 66, fringe: "curtain" }),
  hs("Short straight", "straight", { top: 11, side: 2, end: 98, fringe: "side", part: 1, line: 68 }),
  hs("Medium straight", "straight", { top: 13, side: 5, end: 118, back: 2, fringe: "side", part: -1, line: 66, sheen: true }),
  hs("Long straight", "straight", { top: 13, side: 7, end: 142, back: 4, fringe: "curtain", line: 66, sheen: true }),
  hs("Curtains", "straight", { top: 12, side: 5, end: 122, back: 1, fringe: "curtain", line: 66 }),
  hs("Side part", "straight", { top: 13, side: 2, end: 99, fringe: "side", part: 1, line: 66, sheen: true }),
  hs("Slick back", "straight", { top: 14, side: 1, end: 100, fade: 1, line: 60, sheen: true, fringe: "none", part: 0 }),
  hs("Messy", "wavy", { top: 17, side: 4, edge: "spiky", end: 106, fringe: "messy", line: 68 }),
  hs("Quiff", "straight", { top: 26, side: 2, edge: "tuft", end: 100, fade: 2, fringe: "quiff", line: 64, sheen: true }),
  hs("Mullet", "wavy", { top: 12, side: 3, end: 104, back: 3, fringe: "messy", line: 68 }),
  hs("Receding", "straight", { top: 10, side: 1, end: 100, line: 74, temple: 72, fringe: "none", fade: 1 }),
  hs("Thinning", "straight", { top: 7, side: 1, end: 100, line: 80, temple: 68, density: 0.85 }),
  hs("Sides only", "straight", { top: 0, side: 0.5, end: 110, horseshoe: true, line: 70, back: 1 }),
  hs("Man bun", "wavy", { top: 12, side: 1, end: 100, fade: 2, strands: "bun", line: 64 }),
  hs("Ponytail", "straight", { top: 11, side: 2, end: 104, strands: "ponytail", back: 1, line: 66, fringe: "sweep", part: 1 }),
  hs("Caesar", "straight", { top: 8, side: 1, end: 98, fringe: "caesar", line: 66, fade: 1 }),
  hs("Spiky", "straight", { top: 20, side: 2, edge: "spiky", end: 100, fringe: "messy", line: 66, fade: 1 }),
  hs("Undercut", "straight", { top: 21, side: 1, end: 100, fade: 3, fringe: "sweep", part: 1, line: 62, sheen: true }),
  hs("Bowl cut", "straight", { top: 11, side: 4, end: 100, fringe: "caesar", line: 76, back: 1 }),
];

// ------------------------------------------------------------------ facial features

export const BROW_STYLES = ["Straight", "Arched", "Thin arched", "Soft angle", "Bushy", "Flat thin", "Rounded", "Fierce", "Low heavy", "Long soft"] as const;
export const EYE_SHAPES = ["Almond", "Round", "Wide", "Narrow", "Hooded", "Upturned", "Downturned", "Deep-set"] as const;
export const NOSE_STYLES = ["Straight", "Button", "Broad", "Narrow", "Roman", "Wide base", "Upturned", "Long", "Soft", "Flat bridge", "Crooked", "Broad tip"] as const;
export const MOUTH_STYLES = ["Neutral", "Slight smile", "Smirk", "Smile", "Thin", "Full", "Wide", "Small", "Stern", "Parted"] as const;
export const EAR_STYLES = ["Small", "Medium", "Large"] as const;
export const FACIAL_HAIR = [
  "Clean shaven", "Light stubble", "Heavy stubble", "Moustache", "Thin moustache", "Goatee", "Moustache + goatee", "Soul patch",
  "Short beard", "Boxed beard", "Full beard", "Long beard", "Chin beard", "Sideburns", "Mutton chops", "Chinstrap",
] as const;
export const SCARS = ["None", "Cheek scar", "Eyebrow scar", "Chin scar"] as const;
export const MARKS = ["None", "Beauty mark left", "Beauty mark right"] as const;
export const ACCESSORIES = ["None", "Headband", "Ear stud"] as const;

// ------------------------------------------------------------------ numeric geometry

export interface FaceGeometry {
  headWidth: number;
  headHeight: number;
  eyeSpacing: number;
  eyebrowAngle: number;
  noseScale: number;
  earScale: number;
}

/** Stored 0-100, 50 = neutral. Ranges stay small so the artwork keeps lining up. */
export const GEO_RANGES = {
  headWidth: [0.92, 1.08],
  headHeight: [0.96, 1.04],
  eyeSpacing: [0.94, 1.06],
  eyebrowAngle: [-5, 5],
  noseScale: [0.9, 1.1],
  earScale: [0.9, 1.1],
} as const;

export const geoValue = (key: keyof FaceGeometry, stored: number): number => {
  const [lo, hi] = GEO_RANGES[key];
  return lo + (hi - lo) * (Math.max(0, Math.min(100, stored)) / 100);
};

// ------------------------------------------------------------------ the stored appearance

export const APPEARANCE_KEYS = [
  "skin", "face", "hair", "hairColor", "brow", "browColor", "eyes", "eyeColor", "nose", "mouth", "facial", "facialColor", "ear",
  "freckles", "scar", "mark", "accessory", "headW", "headH", "eyeSp", "browAng", "noseSc", "earSc", "aging",
] as const;
export type AppearanceKey = (typeof APPEARANCE_KEYS)[number];

export const COUNTS: Record<Exclude<AppearanceKey, "headW" | "headH" | "eyeSp" | "browAng" | "noseSc" | "earSc" | "aging">, number> = {
  skin: SKIN_TONES.length,
  face: FACE_SHAPES.length,
  hair: HAIR_STYLES.length,
  hairColor: HAIR_COLORS.length,
  brow: BROW_STYLES.length,
  browColor: HAIR_COLORS.length,
  eyes: EYE_SHAPES.length,
  eyeColor: EYE_COLORS.length,
  nose: NOSE_STYLES.length,
  mouth: MOUTH_STYLES.length,
  facial: FACIAL_HAIR.length,
  facialColor: HAIR_COLORS.length,
  ear: EAR_STYLES.length,
  freckles: 2,
  scar: SCARS.length,
  mark: MARKS.length,
  accessory: ACCESSORIES.length,
};
