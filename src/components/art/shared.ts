import type { Appearance } from "@/engine/types";

/** Colour and seeding helpers shared by the portrait renderers. */

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: readonly number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export const luminance = (c: string) => {
  const [r, g, b] = hex(c);
  return (r * 0.3 + g * 0.59 + b * 0.11) / 255;
};

/** Small deterministic noise in [0, 1) for designed variation (never Math.random). */
export function hash01(seed: number, i: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) % 10000) / 10000;
}

/** Muted print-ink backgrounds: navy, green, brown, burgundy, slate, cream. */
const BACKDROPS = ["#2c3a52", "#2f4a3c", "#5b3d2a", "#56242f", "#4a6073", "#d8ccaa", "#3b3a52", "#6a5a3a"];
const cdist = (a: string, b: string) => Math.hypot(...hex(a).map((v, i) => v - hex(b)[i]));

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
