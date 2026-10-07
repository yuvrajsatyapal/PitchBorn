import { EYE_COLORS, HAIR_COLORS, SKIN_TONES, geoValue } from "@/engine/appearance/options";
import { ageLook } from "@/engine/appearance/age";
import type { Appearance } from "@/engine/types";
import { REFERENCE_FACE, type BrowSpec, type EyeSpec, type FaceSpec, type MouthSpec, type NoseSpec } from "./anatomy";
import type { PortraitModel } from "./art";
import { clamp, hash01, mix } from "./geometry";
import { hairTint } from "./hair";

/**
 * Each stored option is a designed piece of anatomy. Heads are separate silhouettes (temple, cheekbone, jaw corner,
 * chin), not a rescaled oval; features are separate constructions. Indexes match the option names in options.ts.
 */
interface HeadSpec {
  skullW: number;
  templeW: number;
  cheekW: number;
  cheekDy: number;
  jawW: number;
  jawY: number;
  jawR: number;
  chinW: number;
  chinH: number;
  chinSq: number;
  chinY: number;
  cleft?: number;
}

export const HEADS: readonly HeadSpec[] = [
  /* Oval */ { skullW: 71, templeW: 67, cheekW: 73, cheekDy: 15, jawW: 60, jawY: 250, jawR: 16, chinW: 22, chinH: 8, chinSq: 0.5, chinY: 283 },
  /* Round */ { skullW: 75, templeW: 72, cheekW: 79, cheekDy: 19, jawW: 69, jawY: 243, jawR: 24, chinW: 30, chinH: 8, chinSq: 0.4, chinY: 276 },
  /* Square */ { skullW: 73, templeW: 70, cheekW: 75, cheekDy: 16, jawW: 71, jawY: 255, jawR: 6, chinW: 33, chinH: 10, chinSq: 0.92, chinY: 284 },
  /* Rectangular */ { skullW: 70, templeW: 67, cheekW: 71, cheekDy: 15, jawW: 66, jawY: 260, jawR: 8, chinW: 30, chinH: 10, chinSq: 0.85, chinY: 292 },
  /* Diamond */ { skullW: 66, templeW: 60, cheekW: 79, cheekDy: 13, jawW: 57, jawY: 247, jawR: 7, chinW: 18, chinH: 8, chinSq: 0.5, chinY: 283 },
  /* Narrow */ { skullW: 65, templeW: 61, cheekW: 67, cheekDy: 14, jawW: 56, jawY: 252, jawR: 12, chinW: 20, chinH: 9, chinSq: 0.55, chinY: 288 },
  /* Broad */ { skullW: 77, templeW: 74, cheekW: 81, cheekDy: 17, jawW: 72, jawY: 250, jawR: 12, chinW: 32, chinH: 9, chinSq: 0.7, chinY: 282 },
  /* Long */ { skullW: 67, templeW: 63, cheekW: 70, cheekDy: 12, jawW: 54, jawY: 256, jawR: 12, chinW: 18, chinH: 9, chinSq: 0.45, chinY: 296 },
  /* Heart */ { skullW: 75, templeW: 72, cheekW: 74, cheekDy: 13, jawW: 55, jawY: 244, jawR: 14, chinW: 18, chinH: 8, chinSq: 0.55, chinY: 277 },
  /* Strong jaw */ { skullW: 73, templeW: 69, cheekW: 75, cheekDy: 15, jawW: 66, jawY: 249, jawR: 8, chinW: 27, chinH: 7, chinSq: 0.62, chinY: 281, cleft: 0.8 },
  /* High cheekbones */ { skullW: 68, templeW: 63, cheekW: 80, cheekDy: 10, jawW: 58, jawY: 252, jawR: 9, chinW: 22, chinH: 8, chinSq: 0.6, chinY: 286 },
  /* Soft jaw */ { skullW: 72, templeW: 69, cheekW: 75, cheekDy: 18, jawW: 64, jawY: 246, jawR: 26, chinW: 25, chinH: 7, chinSq: 0.35, chinY: 280 },
];

type EyeShape = Omit<EyeSpec, "gap">;
export const EYES: readonly EyeShape[] = [
  /* Almond */ { w: 15.5, h: 6.8, lo: 4, tilt: -1, iris: 6.8, lash: 3.2, crease: 6, hood: 0, deep: 0.5, bag: 0 },
  /* Round */ { w: 14.5, h: 8, lo: 5, tilt: 0, iris: 7.4, lash: 2.8, crease: 8, hood: 0, deep: 0.2, bag: 0.2 },
  /* Wide */ { w: 17, h: 7, lo: 4.4, tilt: -0.4, iris: 7, lash: 3, crease: 7, hood: 0, deep: 0.3, bag: 0 },
  /* Narrow */ { w: 15.5, h: 4.8, lo: 3, tilt: 0, iris: 6, lash: 3.6, crease: 3.5, hood: 0, deep: 0.6, bag: 0 },
  /* Hooded */ { w: 15, h: 5.6, lo: 3.4, tilt: -0.5, iris: 6.4, lash: 3.4, crease: 3, hood: 1, deep: 0.6, bag: 0 },
  /* Upturned */ { w: 15, h: 6.4, lo: 3.8, tilt: -2.6, iris: 6.6, lash: 3.2, crease: 6, hood: 0, deep: 0.4, bag: 0 },
  /* Downturned */ { w: 15, h: 6.4, lo: 4, tilt: 2.2, iris: 6.6, lash: 3, crease: 5.5, hood: 0, deep: 0.4, bag: 0.6 },
  /* Deep-set */ { w: 14.5, h: 5.6, lo: 3.4, tilt: 0.4, iris: 6, lash: 3.4, crease: 4, hood: 0, deep: 1, bag: 0.4 },
];

type BrowShape = Omit<BrowSpec, "gap">;
export const BROWS: readonly BrowShape[] = [
  /* Straight */ { head: 8, mid: 7, tail: 3, arch: 1.2, peak: 0.5, len: 37, lift: 1, low: 17, ragged: 0 },
  /* Arched */ { head: 7.4, mid: 6.8, tail: 2.8, arch: 4.6, peak: 0.55, len: 36, lift: 0.5, low: 18.5, ragged: 0 },
  /* Thin arched */ { head: 4.8, mid: 4.4, tail: 2, arch: 4.8, peak: 0.55, len: 36, lift: 0.5, low: 19, ragged: 0 },
  /* Soft angle */ { head: 7.6, mid: 6.8, tail: 3, arch: 3.2, peak: 0.62, len: 37, lift: 2.5, low: 17, ragged: 0 },
  /* Bushy */ { head: 10, mid: 9, tail: 4.5, arch: 2, peak: 0.5, len: 37, lift: 0.5, low: 16, ragged: 1 },
  /* Flat thin */ { head: 5, mid: 4.4, tail: 2, arch: 0.8, peak: 0.5, len: 36, lift: 0, low: 17, ragged: 0 },
  /* Rounded */ { head: 7, mid: 7, tail: 3, arch: 4, peak: 0.45, len: 33, lift: -0.5, low: 18, ragged: 0 },
  /* Fierce */ { head: 8.6, mid: 7.4, tail: 2.6, arch: 2.6, peak: 0.6, len: 37, lift: 6, low: 15, ragged: 0 },
  /* Low heavy */ { head: 9.6, mid: 8.6, tail: 4, arch: 1.2, peak: 0.5, len: 38, lift: 0.4, low: 13.5, ragged: 0.8 },
  /* Long soft */ { head: 6, mid: 5.6, tail: 2.6, arch: 3.2, peak: 0.5, len: 41, lift: -0.4, low: 18, ragged: 0 },
];

/** dy moves the base of the nose: long noses sit lower, button noses higher. */
export const NOSES: readonly (NoseSpec & { dy: number })[] = [
  /* Straight */ { w: 16.5, bridge: 5.5, tip: 9.5, drop: 1.6, nostril: 1, up: 0, hump: 0.6, crook: 0, flare: 1.2, dy: 0 },
  /* Button */ { w: 15, bridge: 4.6, tip: 9.5, drop: 0.8, nostril: 0.9, up: 1.3, hump: 0, crook: 0, flare: 0.8, dy: -6 },
  /* Broad */ { w: 21, bridge: 6.6, tip: 12, drop: 1, nostril: 1.3, up: 0.4, hump: 0, crook: 0, flare: 2.8, dy: -1 },
  /* Narrow */ { w: 13.5, bridge: 4, tip: 7.4, drop: 2.2, nostril: 0.75, up: 0, hump: 0.4, crook: 0, flare: 0.4, dy: 2 },
  /* Roman */ { w: 15.5, bridge: 5, tip: 8.4, drop: 3, nostril: 0.85, up: 0, hump: 3, crook: 0, flare: 0.8, dy: 3 },
  /* Wide base */ { w: 22, bridge: 5.6, tip: 11, drop: 1.2, nostril: 1.25, up: 0.2, hump: 0, crook: 0, flare: 4, dy: -1 },
  /* Upturned */ { w: 16, bridge: 4.8, tip: 9.6, drop: 0.4, nostril: 1.05, up: 1.8, hump: 0, crook: 0, flare: 1.2, dy: -3 },
  /* Long */ { w: 16, bridge: 5, tip: 8.8, drop: 2.6, nostril: 0.9, up: 0, hump: 1, crook: 0, flare: 1, dy: 7 },
  /* Soft */ { w: 18, bridge: 6, tip: 11, drop: 1.4, nostril: 1.05, up: 0.3, hump: 0, crook: 0, flare: 1.8, dy: 0 },
  /* Flat bridge */ { w: 19.5, bridge: 7.4, tip: 11, drop: 0.6, nostril: 1.2, up: 0.3, hump: 0, crook: 0, flare: 2.4, dy: -3 },
  /* Crooked */ { w: 16, bridge: 5, tip: 8.6, drop: 2, nostril: 1, up: 0, hump: 1.6, crook: 2.8, flare: 1, dy: 1 },
  /* Broad tip */ { w: 17.5, bridge: 5.2, tip: 12.5, drop: 2.2, nostril: 1.1, up: 0, hump: 0, crook: 0, flare: 2, dy: 0 },
];

export const MOUTHS: readonly MouthSpec[] = [
  /* Neutral */ { w: 24, up: 4.6, lo: 6.4, corner: -0.4, bow: 6, part: 0, teeth: 0, smirk: 0 },
  /* Slight smile */ { w: 24.5, up: 4.4, lo: 6.2, corner: 1.4, bow: 6, part: 0, teeth: 0, smirk: 0 },
  /* Smirk */ { w: 24, up: 4.2, lo: 6, corner: 0.2, bow: 5.6, part: 0, teeth: 0, smirk: 1.8 },
  /* Smile */ { w: 26, up: 4, lo: 6.4, corner: 2.6, bow: 6, part: 0.8, teeth: 2.4, smirk: 0 },
  /* Thin */ { w: 24, up: 2.8, lo: 4.2, corner: -0.6, bow: 5.4, part: 0, teeth: 0, smirk: 0 },
  /* Full */ { w: 24, up: 6.2, lo: 8.4, corner: -0.2, bow: 6.6, part: 0, teeth: 0, smirk: 0 },
  /* Wide */ { w: 28, up: 4.2, lo: 6, corner: -0.2, bow: 7, part: 0, teeth: 0, smirk: 0 },
  /* Small */ { w: 19.5, up: 4.6, lo: 6.2, corner: -0.3, bow: 5, part: 0, teeth: 0, smirk: 0 },
  /* Stern */ { w: 24, up: 3.6, lo: 5.4, corner: -1.8, bow: 5.6, part: 0, teeth: 0, smirk: 0 },
  /* Parted */ { w: 24, up: 4.6, lo: 6.6, corner: -0.2, bow: 6, part: 2, teeth: 0, smirk: 0 },
];

export const EAR_W = [14, 16.5, 19] as const;

/** Small designed differences per player, seeded by the hidden `aging` gene so editing one feature never moves another. */
const vary = (a: Appearance, salt: number, i: number, span: number) => (hash01(a.aging * 131 + salt, i) - 0.5) * 2 * span;

export function faceSpecFor(a: Appearance, age: number): FaceSpec {
  const look = ageLook(a, age);
  const H = HEADS[a.face] ?? HEADS[0];
  const wk = geoValue("headWidth", a.headW);
  const hk = geoValue("headHeight", a.headH);
  const r = REFERENCE_FACE;
  const hv = (i: number, span: number) => vary(a, 11 + a.face, i, span);
  const eyeY = r.eyeY;
  // Vertical extents scale around the eye line, widths around the centre line.
  const Y = (y: number) => eyeY + (y - eyeY) * hk;
  const chinY = Y(H.chinY + hv(1, 3));
  const youth = look.youth;
  const top = Y(r.top + hv(2, 2));
  const browY = Y(r.browY);
  const nose = NOSES[a.nose] ?? NOSES[0];
  const ns = geoValue("noseScale", a.noseSc);
  const nv = (i: number, span: number) => vary(a, 41 + a.nose, i, span);
  const noseY = eyeY + (chinY - eyeY) * 0.425 + nose.dy + (ns - 1) * 30 + nv(1, 1.5);
  const mouth = MOUTHS[a.mouth] ?? MOUTHS[0];
  const mv = (i: number, span: number) => vary(a, 61 + a.mouth, i, span);
  const mouthY = Math.max(noseY + 20, eyeY + (chinY - eyeY) * 0.65 + mv(1, 1.5));
  const eye = EYES[a.eyes] ?? EYES[0];
  const ev = (i: number, span: number) => vary(a, 81 + a.eyes, i, span);
  const brow = BROWS[a.brow] ?? BROWS[0];
  const bv = (i: number, span: number) => vary(a, 101 + a.brow, i, span);
  const angle = geoValue("eyebrowAngle", a.browAng);
  const es = geoValue("earScale", a.earSc);
  const jawW = (H.jawW + hv(3, 2.5) - youth * 2) * wk;
  return {
    top,
    skullW: (H.skullW + hv(4, 1.5)) * wk,
    templeW: (H.templeW + hv(5, 1.5)) * wk,
    cheekW: (H.cheekW + hv(6, 2)) * wk,
    cheekDy: H.cheekDy + hv(7, 2),
    jawW,
    jawY: Y(H.jawY + hv(8, 3)),
    // Teenagers' jaws are softer; the corner sharpens into the twenties.
    jawR: H.jawR + youth * 7,
    chinW: (H.chinW + hv(9, 2)) * wk,
    chinH: H.chinH,
    chinSq: clamp(H.chinSq + hv(10, 0.08), 0.25, 1),
    chinY,
    cleft: H.cleft ?? (hash01(a.aging, 77) > 0.9 ? 0.6 : 0),
    browY,
    eyeY,
    noseY,
    mouthY,
    eye: { ...eye, h: eye.h + ev(1, 0.4), tilt: eye.tilt + ev(2, 0.4), gap: 34 * geoValue("eyeSpacing", a.eyeSp) * Math.sqrt(wk) },
    brow: { ...brow, gap: 12 + bv(1, 1), low: brow.low + bv(2, 1.2), lift: brow.lift - angle * 0.9, head: brow.head * (1 - youth * 0.12), mid: brow.mid * (1 - youth * 0.12) },
    nose: { ...nose, w: nose.w * ns + nv(2, 0.8), bridge: nose.bridge * ns, tip: nose.tip * ns, hump: nose.hump + Math.max(0, nv(3, 0.5)) },
    mouth: { ...mouth, w: mouth.w + mv(2, 1.2) },
    ear: { w: (EAR_W[a.ear] ?? EAR_W[1]) * es, top: eyeY - 15 + vary(a, 121, 1, 2), bot: noseY + 3 + (es - 1) * 20 },
    neckW: jawW * 0.76 + hv(11, 3) - youth * 3,
    adam: clamp(0.4 + hv(12, 0.5), 0, 1),
    asym: { eye: 0.05 + Math.abs(vary(a, 141, 1, 0.06)), brow: vary(a, 141, 2, 2), mouth: vary(a, 141, 3, 1.1), ear: vary(a, 141, 4, 2.6), jaw: vary(a, 141, 5, 2) },
  };
}

/** Muted print-ink backgrounds: navy, green, brown, burgundy, slate, cream. */
const BACKDROPS = ["#2c3a52", "#2f4a3c", "#5b3d2a", "#56242f", "#4a6073", "#d8ccaa", "#3b3a52", "#6a5a3a"];
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const cdist = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

/** A backdrop that is stable per player and stays clear of the shirt colour. */
export function backdropFor(a: Appearance, kit: string): string {
  const start = Math.floor(hash01(a.aging * 7 + a.face, a.skin) * BACKDROPS.length);
  const k = /^#[0-9a-f]{6}$/i.test(kit) ? kit : null;
  for (let i = 0; i < BACKDROPS.length; i++) {
    const c = BACKDROPS[(start + i) % BACKDROPS.length];
    if (!k || cdist(c, k) > 90) return c;
  }
  return BACKDROPS[0];
}

export function modelFor(a: Appearance, age: number, kit: string, trim: string, background?: string): PortraitModel {
  const look = ageLook(a, age);
  const hair = HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0];
  const brow = HAIR_COLORS[a.browColor] ?? HAIR_COLORS[0];
  const skin = SKIN_TONES[a.skin] ?? SKIN_TONES[0];
  return {
    f: faceSpecFor(a, age),
    skin,
    iris: EYE_COLORS[a.eyeColor] ?? EYE_COLORS[0],
    hair: a.hair,
    hairColor: hairTint(hair, look.grey),
    // Fair brows still need to read against the skin.
    browColor: mix(hairTint(brow, look.grey * 0.7), "#1d130d", 0.18 + 0.2 * (1 - Math.abs(parseInt(brow.slice(1, 3), 16) - parseInt(skin.slice(1, 3), 16)) / 255)),
    facial: a.facial,
    facialColor: hairTint(HAIR_COLORS[a.facialColor] ?? HAIR_COLORS[0], look.facialGrey),
    recede: look.recede,
    facialGrey: look.facialGrey,
    lines: look.lines,
    youth: look.youth,
    freckles: !!a.freckles,
    scar: a.scar,
    mark: a.mark,
    accessory: a.accessory,
    kit,
    trim,
    background: background ?? backdropFor(a, kit),
  };
}
