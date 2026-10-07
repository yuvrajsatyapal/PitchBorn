import { REFERENCE_FACE, type FaceSpec } from "../../src/components/art/portrait/anatomy";

type Deep = { [K in keyof FaceSpec]?: FaceSpec[K] extends object ? Partial<FaceSpec[K]> : FaceSpec[K] };

export const face = (d: Deep): FaceSpec => ({
  ...REFERENCE_FACE,
  ...(d as Partial<FaceSpec>),
  eye: { ...REFERENCE_FACE.eye, ...d.eye },
  brow: { ...REFERENCE_FACE.brow, ...d.brow },
  nose: { ...REFERENCE_FACE.nose, ...d.nose },
  mouth: { ...REFERENCE_FACE.mouth, ...d.mouth },
  ear: { ...REFERENCE_FACE.ear, ...d.ear },
  asym: { ...REFERENCE_FACE.asym, ...d.asym },
});

/** Six designed men for the face-diversity and bald tests. */
export const SIX_FACES: FaceSpec[] = [
  // The reference: strong square jaw, level gaze.
  face({}),
  // Long and narrow: high cheekbones, deep-set eyes, long aquiline nose, thin wide mouth, big ears.
  face({
    top: 46, skullW: 66, templeW: 62, cheekW: 70, cheekDy: 11, jawW: 52, jawY: 254, jawR: 12, chinW: 17, chinH: 9, chinSq: 0.45, chinY: 294,
    browY: 141, eyeY: 159, noseY: 219, mouthY: 248,
    eye: { w: 14.5, h: 5.4, lo: 3.2, tilt: 0.6, gap: 31, iris: 6, lash: 3.4, crease: 4, deep: 1, bag: 0.4 },
    brow: { head: 5.6, mid: 5, tail: 2.2, arch: 1.2, peak: 0.5, len: 35, lift: 0.8, gap: 11, low: 14 },
    nose: { w: 14, bridge: 4.2, tip: 7.6, drop: 3.4, nostril: 0.8, hump: 3, flare: 0.5 },
    mouth: { w: 25, up: 3, lo: 4.4, corner: -1.3, bow: 5 },
    ear: { w: 20, top: 141, bot: 220 },
    neckW: 44,
    asym: { eye: 0.1, brow: 2.2, mouth: -0.6, ear: -2.5, jaw: 1 },
  }),
  // Round and broad: soft jaw, round eyes, wide flat nose, full lips, arched brows, small ears.
  face({
    top: 54, skullW: 76, templeW: 73, cheekW: 81, cheekDy: 20, jawW: 71, jawY: 242, jawR: 24, chinW: 31, chinH: 8, chinSq: 0.38, chinY: 276,
    browY: 146, eyeY: 163, noseY: 210, mouthY: 236,
    eye: { w: 15.5, h: 7.8, lo: 4.8, tilt: 0.2, gap: 35.5, iris: 7.6, lash: 2.8, crease: 7.5, deep: 0.2, bag: 0.5 },
    brow: { head: 7, mid: 7.6, tail: 3.4, arch: 5.4, peak: 0.5, len: 36, lift: -0.5, gap: 13.5, low: 20, ragged: 0.5 },
    nose: { w: 21.5, bridge: 6.6, tip: 12, drop: 0.8, nostril: 1.35, up: 0.6, hump: 0, flare: 3 },
    mouth: { w: 24, up: 6.2, lo: 8.4, corner: 0.2, bow: 6.5 },
    ear: { w: 14, top: 151, bot: 210 },
    neckW: 57,
    asym: { eye: 0.05, brow: 1, mouth: 1.2, ear: 1.5, jaw: 2 },
  }),
  // Diamond: narrow temples, wide cheekbones, hooded upturned eyes, broken nose, smirk.
  face({
    skullW: 66, templeW: 60, cheekW: 80, cheekDy: 13, jawW: 57, jawY: 247, jawR: 6, chinW: 18, chinH: 8, chinSq: 0.5, chinY: 283,
    eye: { w: 15, h: 5.6, lo: 3.4, tilt: -2.4, gap: 33, iris: 6.4, lash: 3.5, crease: 3, hood: 1, deep: 0.6 },
    brow: { head: 7.4, mid: 6.2, tail: 2.6, arch: 2.4, peak: 0.62, len: 36, lift: 6.5, gap: 12, low: 15 },
    nose: { w: 16, bridge: 5, tip: 8.6, drop: 2, nostril: 1, hump: 1.6, crook: 2.8, flare: 1 },
    mouth: { w: 26, up: 3.4, lo: 5, corner: 0, smirk: 1.8, bow: 5 },
    ear: { w: 16, top: 144, bot: 211 },
    asym: { eye: 0.12, brow: -1.6, mouth: 0.5, ear: 3, jaw: -1.2 },
  }),
  // Square and heavy: broad jaw, cleft chin, low heavy brows, small deep eyes, short wide nose, wide mouth, thick neck.
  face({
    skullW: 74, templeW: 70, cheekW: 77, cheekDy: 16, jawW: 73, jawY: 256, jawR: 5, chinW: 35, chinH: 10, chinSq: 0.95, chinY: 285, cleft: 1,
    browY: 142, eyeY: 161, noseY: 206, mouthY: 236,
    eye: { w: 14, h: 5.6, lo: 3.4, tilt: 0.7, gap: 33.5, iris: 6, lash: 3.5, crease: 4.5, deep: 0.9, bag: 0.3 },
    brow: { head: 9.8, mid: 8.8, tail: 4, arch: 1.2, peak: 0.5, len: 38, lift: 0.4, gap: 10.5, low: 13, ragged: 1 },
    nose: { w: 19.5, bridge: 7.2, tip: 11, drop: 0.5, nostril: 1.2, hump: 0, flare: 2.2 },
    mouth: { w: 28, up: 4, lo: 6, corner: -1.5, bow: 7 },
    ear: { w: 15, top: 145, bot: 208 },
    neckW: 60,
    adam: 1,
    asym: { eye: 0.06, brow: 1.2, mouth: -0.8, ear: 1.8, jaw: 2.2 },
  }),
  // Heart: broad forehead, narrow chin, large almond eyes, small upturned nose, small full mouth, fine arched brows.
  face({
    top: 46, skullW: 75, templeW: 72, cheekW: 74, cheekDy: 13, jawW: 55, jawY: 244, jawR: 14, chinW: 18, chinH: 8, chinSq: 0.55, chinY: 277,
    browY: 144, eyeY: 163, noseY: 209, mouthY: 234,
    eye: { w: 15.5, h: 8, lo: 4.6, tilt: -1.4, gap: 34.5, iris: 7.6, lash: 3, crease: 8, deep: 0.3 },
    brow: { head: 5.6, mid: 5.2, tail: 2.2, arch: 4.8, peak: 0.6, len: 36, lift: 2, gap: 13, low: 20.5 },
    nose: { w: 15, bridge: 4.6, tip: 8.6, drop: 1, nostril: 0.9, up: 1.3, hump: 0, flare: 0.8 },
    mouth: { w: 20, up: 5.2, lo: 7.2, corner: -0.3, bow: 5.5 },
    ear: { w: 16, top: 149, bot: 212 },
    neckW: 45,
    asym: { eye: 0.08, brow: 1.8, mouth: 0.8, ear: -2, jaw: 1 },
  }),
];
