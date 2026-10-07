/**
 * The shared master canvas every illustrated portrait asset is drawn on. Artists paint each layer in place on a
 * 512 x 512 transparent canvas over the guide (art/portrait/canvas-guide.svg); the build step trims empty space and
 * records the offset, so code never positions artwork by eye.
 */
export const CANVAS = 512;

/** Landmarks on the master canvas (px). Every face, feature, hairstyle and beard is drawn to these lines. */
export const LANDMARKS = {
  centreX: 256,
  /** Top of the bare skull. Hair rises above it. */
  crown: 72,
  /** Standard front hairline at the centre. */
  hairline: 128,
  /** Temple line (where the hairline meets the side of the head) and half-width of the head there. */
  temple: { y: 200, halfWidth: 108 },
  brow: 218,
  /** Pupil line and each pupil's distance from the centre line. */
  eye: { y: 246, gap: 53 },
  cheekbone: { y: 270, halfWidth: 118 },
  ear: { top: 223, bottom: 331 },
  /** Base of the nose (where the nose meets the upper lip). */
  nose: 327,
  /** Mouth line. */
  mouth: 369,
  jawCorner: { y: 385, halfWidth: 104 },
  chin: 435,
  neck: { top: 400, halfWidth: 79 },
  /** Top of the collar at the centre, and where the shoulders leave the canvas. */
  collar: 468,
  shoulders: 490,
} as const;

/**
 * Back-to-front composition order. The kit goes before the head so long beards and long hair fall over the collar,
 * and the global print texture sits on top of everything.
 */
export const LAYER_ORDER = [
  "background",
  "hairBack",
  "neck",
  "kit",
  "ears",
  "face",
  "eyes",
  "eyebrows",
  "nose",
  "mouth",
  "details",
  "facialHair",
  "hairFront",
  "accessory",
  "texture",
] as const;
export type LayerGroup = (typeof LAYER_ORDER)[number];
