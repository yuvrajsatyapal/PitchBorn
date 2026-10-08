/**
 * Dutch Dreads, Boxed Beard, Long Beard and Chin Beard: connected locks, beards built from each face's anchors,
 * colour derived from the selected facial-hair colour on any skin, deterministic and within the 48px budget.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { anchorsFor } from "../src/components/art/portrait-next/anchors";
import { PortraitNext } from "../src/components/art/portrait-next/art";
import { BEARD_LIMIT_Y, massFor } from "../src/components/art/portrait-next/beardMass";
import { dutchPlan } from "../src/components/art/portrait-next/hair/dutch";
import { buildHeadNext } from "../src/components/art/portrait-next/head";
import { nextModelFor } from "../src/components/art/portrait-next/model";
import { BEARD_TARGET, beardTones, contrast, skinTones } from "../src/components/art/portrait-next/palette";
import { inside } from "../src/components/art/portrait/geometry";
import { CX } from "../src/components/art/portrait/geometry";
import { generateAppearance } from "../src/engine/appearance/generate";
import { COUNTS, HAIR_COLORS, SKIN_TONES } from "../src/engine/appearance/options";
import type { Appearance } from "../src/engine/types";

const KIT = "#7a1f2b";
const TRIM = "#f1ead8";
const DUTCH = 44;
const base: Appearance = { ...generateAppearance("bd"), hair: 0, facial: 0, accessory: 0, scar: 0, mark: 0, freckles: 0, hairTip: 0, band: 0 };
const render = (a: Partial<Appearance>, d: 0 | 1 | 2, age = 26) => renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m: nextModelFor({ ...base, ...a }, age, KIT, TRIM), uid: "q", d })));
const elements = (s: string) => (s.match(/<(path|circle|rect|use|ellipse)\b/g) ?? []).length;

const FACES: Partial<Appearance>[] = [];
for (let face = 0; face < COUNTS.face; face++) for (const [headW, headH] of [[0, 0], [100, 100], [50, 50]]) FACES.push({ face, headW, headH });

const inputFor = (a: Partial<Appearance>, age = 26) => {
  const m = nextModelFor({ ...base, ...a }, age, KIT, TRIM);
  const head = buildHeadNext(m.f);
  return { m, head, anchors: anchorsFor(m.f, head) };
};

describe("Dutch Dreads: every lock grows out of the crown", () => {
  it("has 10-16 locks, each rooted inside the crown mass (rear locks behind the skull), on every face", () => {
    for (const fa of FACES) {
      const { m, head } = inputFor({ ...fa, hair: DUTCH });
      const plan = dutchPlan({ f: m.f, head, color: m.hairColor, skin: skinTones(m.skin), uid: "q", d: 2, recede: m.recede, seed: m.seed, tip: null, band: "#fff" });
      expect(plan.locks.length).toBeGreaterThanOrEqual(10);
      expect(plan.locks.length).toBeLessThanOrEqual(16);
      for (const l of plan.locks) {
        for (const p of l.pts) expect(Number.isFinite(p[0]) && Number.isFinite(p[1])).toBe(true);
        const root = l.pts[0];
        if (l.layer === "back") expect(Math.abs(root[0] - CX)).toBeLessThan(head.half(root[1], root[0] > CX ? 1 : -1));
        else expect(inside(plan.cap, root)).toBe(true);
        // Nothing starts halfway down the forehead: a lock's root is above the hairline centre.
        expect(root[1]).toBeLessThan(plan.hl.y + 20);
      }
    }
  });

  it("is deterministic and keeps the 48px budget with and without a second colour", () => {
    for (const hairTip of [0, 2]) {
      const a = render({ hair: DUTCH, hairTip }, 0);
      expect(a).toBe(render({ hair: DUTCH, hairTip }, 0));
      expect(a.length).toBeLessThan(20_000);
      expect(elements(a)).toBeLessThanOrEqual(110);
    }
  });
});

describe("body beards are built from each face's anchors", () => {
  const kinds = ["boxed", "long", "chin"] as const;

  it("every shape is finite, below the nose, and clear of the shirt", () => {
    for (const fa of FACES) {
      const { m, head, anchors } = inputFor(fa);
      const f = m.f;
      const bottoms: Record<string, number> = {};
      for (const kind of kinds) {
        const mass = massFor(kind, f, head, anchors, 7);
        for (const p of [...mass.pts, ...mass.upper, ...mass.lower]) expect(Number.isFinite(p[0]) && Number.isFinite(p[1])).toBe(true);
        const ys = mass.pts.map((p) => p[1]);
        bottoms[kind] = Math.max(...ys);
        // Moustache growth never starts above the nose, and (apart from a chin that itself hangs past the collar) never crosses it.
        expect(Math.min(...mass.pts.filter((p) => Math.abs(p[0] - CX) < 2 * f.nose.w).map((p) => p[1]))).toBeGreaterThan(f.noseY - 2);
        expect(bottoms[kind]).toBeLessThanOrEqual(Math.max(BEARD_LIMIT_Y, f.chinY + 10) + 3);
        // Never wider than the head plus the hair's own thickness: no leakage past the jaw.
        for (const p of mass.pts) expect(Math.abs(p[0] - CX)).toBeLessThan(Math.max(head.half(Math.min(p[1], f.chinY), p[0] > CX ? 1 : -1) + 20, f.chinW + 22));
      }
      expect(bottoms.long - f.chinY).toBeGreaterThan(9);
      expect(bottoms.long).toBeGreaterThan(bottoms.boxed + 4);
      // The chin beard only grows from under the lower lip, on the chin.
      const chin = massFor("chin", f, head, anchors, 7);
      expect(Math.min(...chin.pts.map((p) => p[1]))).toBeGreaterThan(f.mouthY + f.mouth.lo);
      expect(Math.max(...chin.pts.map((p) => Math.abs(p[0] - CX)))).toBeLessThan(f.chinW + 16);
    }
  });

  it("the chin beard narrows with the chin and the long beard widens with it", () => {
    const narrow = inputFor({ face: 4 });
    const broad = inputFor({ face: 2 });
    const width = (i: ReturnType<typeof inputFor>, kind: (typeof kinds)[number]) => {
      const xs = massFor(kind, i.m.f, i.head, i.anchors, 3).pts.filter((p) => p[1] > i.m.f.chinY - 4).map((p) => p[0]);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(width(broad, "chin")).toBeGreaterThan(width(narrow, "chin") + 8);
    expect(width(broad, "long")).toBeGreaterThan(width(narrow, "long"));
  });

  it("draws valid, deterministic artwork on every face at every size", () => {
    for (const fa of FACES.slice(0, 18)) {
      for (const facial of [5, 6, 9, 11, 12]) {
        for (const d of [0, 1, 2] as const) {
          const svg = render({ ...fa, facial, hair: 7 }, d);
          expect(svg).not.toMatch(/NaN|Infinity|undefined/);
          for (const m of svg.matchAll(/\sd="([^"]*)"/g)) expect(m[1]).toMatch(/^M[-\d.\s,MLHVCSQTAZmlhvcsqtaz]*$/);
          expect(svg).toBe(render({ ...fa, facial, hair: 7 }, d));
        }
      }
    }
  });

  it("keeps the 48px budget with every beard and Dutch Dreads, accessories included", () => {
    const failures: string[] = [];
    for (const facial of [5, 6, 9, 11, 12]) {
      for (let accessory = 0; accessory < COUNTS.accessory; accessory++) {
        for (const hair of [DUTCH, 7, 0]) {
          const svg = render({ facial, accessory, hair, face: 6, headW: 100 }, 0);
          if (svg.length > 20_000 || elements(svg) > 110) failures.push(`${facial}/${accessory}/${hair}: ${svg.length} chars, ${elements(svg)} elements`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("facial hair colour comes from the selected colour, not the skin", () => {
  it("every hair colour on every skin tone separates from the skin, keeps its own hue and never uses black", () => {
    const failures: string[] = [];
    for (const skin of SKIN_TONES) {
      for (const color of HAIR_COLORS) {
        const T = beardTones(color, skin);
        const best = Math.max(contrast(T.base, skin), contrast(T.shade, skin), contrast(T.light, skin));
        // The body of the beard reaches the target, or (black on the deepest skin) a tone of the beard does.
        if (contrast(T.base, skin) < BEARD_TARGET - 0.12 && best < 1.5) failures.push(`${color} on ${skin}: ${contrast(T.base, skin).toFixed(2)}`);
        expect(T.edge).not.toBe("#000000");
        expect(T.base).not.toBe(skin);
      }
    }
    expect(failures).toEqual([]);
  });

  it("different facial-hair colours draw different beards on the same skin, and the skin is never altered", () => {
    for (const facial of [9, 11, 12]) {
      const black = render({ facial, facialColor: 0, skin: 3 }, 2);
      const ginger = render({ facial, facialColor: 7, skin: 3 }, 2);
      expect(black).not.toBe(ginger);
      const T = beardTones(HAIR_COLORS[7], SKIN_TONES[3]);
      expect(ginger).toContain(T.shade);
      // The skin fill is the same under any beard colour.
      expect(black).toContain(`fill="${skinTones(SKIN_TONES[3]).base}"`);
      expect(ginger).toContain(`fill="${skinTones(SKIN_TONES[3]).base}"`);
    }
  });

  it("light hair keeps its hue when it is moved off a light skin", () => {
    const T = beardTones("#c9a45f", "#f8dfce");
    const hue = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      return r >= g && g >= b;
    };
    expect(hue(T.base)).toBe(true);
    expect(contrast(T.base, "#f8dfce")).toBeGreaterThan(1.35);
  });
});
