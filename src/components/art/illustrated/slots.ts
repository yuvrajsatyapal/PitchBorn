/**
 * Asset slots: every piece of illustrated artwork the portrait can use, where its files live, which of its layers
 * take a colour, and roughly where it sits on the master canvas (for the artist's guide and for placeholders).
 *
 * Files: art/portrait/source/<slot>/<role>.png (full 512 canvas, drawn in place)
 *        -> npm run portraits:assets -> public/portrait/<slot>/<role>.webp (trimmed) + manifest.json (offsets).
 */
import { BROW_STYLES, EYE_SHAPES, FACE_SHAPES, FACIAL_HAIR, MOUTH_STYLES, NOSE_STYLES } from "@/engine/appearance/options";
import { HAIRSTYLES, POC_HAIRSTYLES, type Hairstyle } from "@/engine/appearance/hairstyles";
import type { LayerGroup } from "./canvas";

/**
 * Layer roles inside a slot.
 * mask / secondary-mask / iris-mask / lip-mask: white shapes whose alpha is filled with a chosen colour.
 * shadow: painted shading, composited with multiply. highlight: painted light, composited with screen.
 * ink: final linework and texture, composited normally. white: eye whites. detail: fixed-colour extras.
 * texture: global print texture (multiply).
 */
export type Role = "mask" | "secondary-mask" | "iris-mask" | "lip-mask" | "white" | "shadow" | "highlight" | "ink" | "detail" | "texture";
export type Tint = "skin" | "hair" | "hairSecondary" | "brow" | "facial" | "iris" | "lip" | "kit" | "trim" | "accessory";

export interface Slot {
  path: string;
  group: LayerGroup;
  roles: readonly Role[];
  optional?: readonly Role[];
  tint?: Partial<Record<Role, Tint>>;
  /** x, y, width, height on the master canvas. */
  region: readonly [number, number, number, number];
  /** Part of the first art test. */
  poc: boolean;
}

export const slug = (name: string) => name.toLowerCase().replace(/\+/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const RECOLOR = ["mask", "shadow", "highlight", "ink"] as const;

// ---------------------------------------------------------------- which options are in the first art test

const POC_FACES = ["strong-jaw", "long", "round", "diamond"];
const POC_EYES = ["almond", "hooded", "deep-set"];
const POC_BROWS = ["straight", "soft-angle", "bushy"];
const POC_NOSES = ["straight", "broad", "roman"];
const POC_MOUTHS = ["neutral", "full", "stern"];
const POC_FACIAL = ["light-stubble", "short-beard"];

// ---------------------------------------------------------------- hair regions by kind

function hairRegions(h: Hairstyle): { front: Slot["region"]; back: Slot["region"] } {
  if (h.category === "afro" && h.hasBackLayer) return { front: [80, 0, 352, 300], back: [70, 20, 372, 360] };
  if (h.id === "lion-mane" || h.id === "big-afro") return { front: [40, 0, 432, 400], back: [30, 0, 452, 512] };
  if (h.hasBackLayer) return { front: [120, 30, 272, 330], back: [100, 60, 312, 452] };
  return { front: [132, 20, 248, 210], back: [132, 20, 248, 210] };
}

/** Styles that need their own art (presets reuse another style's slot). */
export const hairArtStyles = (): Hairstyle[] => HAIRSTYLES.filter((h) => !h.preset);

function hairSlots(): Slot[] {
  return hairArtStyles().flatMap((h) => {
    const r = hairRegions(h);
    const poc = (POC_HAIRSTYLES as readonly string[]).includes(h.id);
    const tint: Slot["tint"] = { mask: "hair", "secondary-mask": "hairSecondary" };
    const front: Slot = { path: `hair/${h.id}/front`, group: "hairFront", roles: h.supportsColor ? RECOLOR : ["shadow", "highlight", "ink"], optional: ["secondary-mask", "detail"], tint, region: r.front, poc };
    if (!h.hasBackLayer) return [front];
    return [front, { path: `hair/${h.id}/back`, group: "hairBack", roles: RECOLOR, optional: ["secondary-mask"], tint, region: r.back, poc }];
  });
}

const many = (names: readonly string[], dir: string, group: LayerGroup, roles: readonly Role[], tint: Slot["tint"], region: Slot["region"], poc: readonly string[], optional?: readonly Role[]): Slot[] =>
  names.map((n) => ({ path: `${dir}/${slug(n)}`, group, roles, tint, region, poc: poc.includes(slug(n)), optional }));

export const SLOTS: readonly Slot[] = [
  { path: "base/neck", group: "neck", roles: RECOLOR, tint: { mask: "skin" }, region: [160, 370, 192, 142], poc: true },
  { path: "kits/v-neck", group: "kit", roles: [...RECOLOR, "secondary-mask"], tint: { mask: "kit", "secondary-mask": "trim" }, region: [0, 440, 512, 72], poc: true },
  ...many(FACE_SHAPES.map((f) => f.name), "faces", "face", RECOLOR, { mask: "skin" }, [140, 60, 232, 390], POC_FACES),
  ...many(["Small", "Medium", "Large"], "ears", "ears", ["mask", "shadow", "ink"], { mask: "skin" }, [118, 210, 276, 135], ["medium"]),
  ...many(EYE_SHAPES, "eyes", "eyes", ["white", "iris-mask", "shadow", "ink"], { "iris-mask": "iris" }, [168, 222, 176, 50], POC_EYES),
  ...many(BROW_STYLES, "eyebrows", "eyebrows", ["mask"], { mask: "brow" }, [166, 196, 180, 38], POC_BROWS, ["ink"]),
  ...many(NOSE_STYLES, "noses", "nose", ["shadow", "highlight", "ink"], {}, [214, 232, 84, 110], POC_NOSES),
  ...many(MOUTH_STYLES, "mouths", "mouth", ["lip-mask", "shadow", "highlight", "ink"], { "lip-mask": "lip" }, [204, 342, 104, 56], POC_MOUTHS),
  ...many(FACIAL_HAIR.slice(1), "facialHair", "facialHair", RECOLOR, { mask: "facial" }, [136, 228, 240, 262], POC_FACIAL),
  ...many(["Freckles", "Cheek scar", "Eyebrow scar", "Chin scar", "Beauty mark left", "Beauty mark right"], "details", "details", ["ink"], {}, [150, 190, 212, 260], [], ["shadow"]),
  ...many(["Thin headband", "Thick headband", "Sports headband", "Hair tie", "Ear stud"], "accessories", "accessory", ["mask", "shadow", "ink"], { mask: "accessory" }, [126, 90, 260, 260], ["sports-headband"]),
  ...hairSlots(),
  { path: "textures/paper", group: "texture", roles: ["texture"], region: [0, 0, 512, 512], poc: true },
  { path: "textures/halftone", group: "texture", roles: ["texture"], region: [0, 0, 512, 512], poc: false },
];

export const slotByPath = (path: string): Slot | undefined => SLOTS.find((s) => s.path === path);

/**
 * How each face shape fits shared hair, beard and ear art: hairstyles are drawn on the standard skull and scaled to
 * each head; beards follow the jaw and chin. Starting values come from the face proportions; re-measure them on
 * the delivered face art.
 */
export interface FaceFit {
  skullScale: number;
  jawScale: number;
  /** Ears move out (+) or in (-) by this many px per side. */
  earDx: number;
  /** Chin lower (+) or higher (-) than the standard chin. */
  chinDy: number;
}

const fit = (skullW: number, cheekW: number, jawW: number, chinY: number): FaceFit => ({
  skullScale: Math.round((skullW / 73) * 1000) / 1000,
  jawScale: Math.round((jawW / 66) * 1000) / 1000,
  earDx: Math.round((cheekW - 75) * 1.57),
  chinDy: Math.round((chinY - 281) * 1.57),
});

export const FACE_FIT: Record<string, FaceFit> = {
  oval: fit(71, 73, 60, 283),
  round: fit(75, 79, 69, 276),
  square: fit(73, 75, 71, 284),
  rectangular: fit(70, 71, 66, 292),
  diamond: fit(66, 79, 57, 283),
  narrow: fit(65, 67, 56, 288),
  broad: fit(77, 81, 72, 282),
  long: fit(67, 70, 54, 296),
  heart: fit(75, 74, 55, 277),
  "strong-jaw": fit(73, 75, 66, 281),
  "high-cheekbones": fit(68, 80, 58, 286),
  "soft-jaw": fit(72, 75, 64, 280),
};
