/**
 * Semantic anchors: named places on this particular head, derived from its own geometry (never from a default
 * face). Hair, beards, accessories and marks attach to these, so they follow every face shape and slider: a wider
 * skull moves the temples and ears, a longer chin moves the chin, a bigger ear moves its earring.
 */
import type { FaceSpec, Head } from "../portrait/anatomy";
import { CX, lerp, type Pt } from "../portrait/geometry";
import { SHIRT_Y, halfAt, neckSides } from "./neck";

export interface EarAnchor {
  top: Pt;
  center: Pt;
  bottom: Pt;
  /** Where the ear meets the head (x), its width, and the lobe (earrings hang here). */
  root: number;
  w: number;
  lobe: Pt;
}

export interface Anchors {
  headTop: Pt;
  /** The crown, a little behind and above the hairline centre (where hair grows from). */
  crown: Pt;
  /** Widest points of the skull. */
  headL: Pt;
  headR: Pt;
  foreheadTop: Pt;
  foreheadL: Pt;
  foreheadR: Pt;
  templeL: Pt;
  templeR: Pt;
  earL: EarAnchor;
  earR: EarAnchor;
  browL: Pt;
  browR: Pt;
  eyeL: Pt;
  eyeR: Pt;
  /** Half-width of each eye opening. */
  eyeW: number;
  noseBridge: Pt;
  noseBase: Pt;
  mouth: Pt;
  mouthL: Pt;
  mouthR: Pt;
  cheekL: Pt;
  cheekR: Pt;
  jawL: Pt;
  jawR: Pt;
  chin: Pt;
  neckL: Pt;
  neckR: Pt;
  neckBase: Pt;
  /** Skull width and head height (top of skull to chin): the units of normalized head space. */
  width: number;
  height: number;
}

/** The ear on one side, exactly as the ear is drawn. */
export function earAnchor(f: FaceSpec, head: Head, s: 1 | -1): EarAnchor {
  const e = f.ear;
  const dy = s > 0 ? f.asym.ear : 0;
  const top = e.top + dy;
  const bot = e.bot + dy * 0.6;
  const h = bot - top;
  const w = e.w * (s > 0 ? 1.04 : 1);
  const root = CX + s * (head.half(top + h * 0.4, s) - 5);
  return { top: [root + s * w * 0.6, top - 5], center: [root + s * w * 0.55, top + h * 0.45], bottom: [root + s * w * 0.12, bot + 1], root, w, lobe: [root + s * w * 0.3, bot - 3] };
}

const cache = new Map<string, Anchors>();

export function anchorsFor(f: FaceSpec, head: Head): Anchors {
  const key = `${head.path.length}:${head.path.slice(0, 40)}:${f.eyeY}:${f.noseY}:${f.mouthY}:${f.eye.gap}:${f.brow.gap}:${f.ear.w}:${f.ear.top}:${f.neckW}:${f.mouth.w}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const skullY = f.top + (f.browY - f.top) * 0.4;
  const wL = head.half(skullY, -1);
  const wR = head.half(skullY, 1);
  const foreY = f.top + (f.browY - f.top) * 0.3;
  const brow = (s: 1 | -1): Pt => [CX + s * (f.brow.gap + f.brow.len * 0.5), f.eyeY - f.brow.low + (s > 0 ? f.asym.brow : 0)];
  const neck = neckSides(f);
  const a: Anchors = {
    headTop: [CX, f.top],
    crown: [CX + 4, f.top + 6],
    headL: [CX - wL, skullY],
    headR: [CX + wR, skullY],
    foreheadTop: [CX, foreY],
    foreheadL: [CX - head.half(foreY + 10, -1) * 0.82, foreY + 10],
    foreheadR: [CX + head.half(foreY + 10, 1) * 0.82, foreY + 10],
    templeL: head.left.T,
    templeR: head.right.T,
    earL: earAnchor(f, head, -1),
    earR: earAnchor(f, head, 1),
    browL: brow(-1),
    browR: brow(1),
    eyeL: [CX - f.eye.gap, f.eyeY],
    eyeR: [CX + f.eye.gap, f.eyeY + f.asym.eye * 8],
    eyeW: f.eye.w,
    noseBridge: [CX, lerp(f.browY, f.eyeY, 0.6)],
    noseBase: [CX + f.nose.crook, f.noseY],
    mouth: [CX, f.mouthY],
    mouthL: [CX - f.mouth.w, f.mouthY],
    mouthR: [CX + f.mouth.w, f.mouthY],
    cheekL: [lerp(CX - f.eye.gap - f.eye.w, head.left.K[0], 0.45), lerp(f.eyeY, f.noseY, 0.45)],
    cheekR: [lerp(CX + f.eye.gap + f.eye.w, head.right.K[0], 0.45), lerp(f.eyeY, f.noseY, 0.45)],
    jawL: head.left.J,
    jawR: head.right.J,
    chin: [CX, f.chinY],
    neckL: [CX - halfAt(neck.left, SHIRT_Y - 3), SHIRT_Y - 3],
    neckR: [CX + halfAt(neck.right, SHIRT_Y - 3), SHIRT_Y - 3],
    neckBase: [CX, SHIRT_Y],
    width: wL + wR,
    height: f.chinY - f.top,
  };
  if (cache.size > 300) cache.clear();
  cache.set(key, a);
  return a;
}

/** A point in normalized head space: u across the skull (-1 left edge .. 1 right edge), v down the head (0 top .. 1 chin). */
export const headPoint = (a: Anchors, u: number, v: number): Pt => [CX + (u * a.width) / 2, a.headTop[1] + v * a.height];
