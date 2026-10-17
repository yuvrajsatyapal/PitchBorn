import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PortraitNext } from "../src/components/art/portrait-next/art";
import { HAIR_LIBRARY } from "../src/components/art/portrait-next/hair";
import { rearMasses, type RearDesign } from "../src/components/art/portrait-next/hair/nordic";
import { buildHeadNext } from "../src/components/art/portrait-next/head";
import { nextModelFor } from "../src/components/art/portrait-next/model";
import { SHIRT_Y, halfAt, neckSides } from "../src/components/art/portrait-next/neck";
import { generateAppearance } from "../src/engine/appearance/generate";
import { HAIR_COLORS } from "../src/engine/appearance/options";
import type { Appearance } from "../src/engine/types";

const base: Appearance = { ...generateAppearance("nordic"), facial: 0, accessory: 0, scar: 0, mark: 0 };
const render = (a: Partial<Appearance>, d: 0 | 1 | 2, uid = "z") =>
  renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m: { ...nextModelFor({ ...base, ...a }, 26, "#c8102e", "#f1ead8"), hairStyle: "nordic-sweep" }, uid, d })));
const count = (s: string) => (s.match(/<(path|circle|rect|use|ellipse)\b/g) ?? []).length;
const REAR: RearDesign = HAIR_LIBRARY.length ? { ends: [10, -2, -14], pad: [9, 5, 1.5], spread: [30, 20, 12], width: [26, 24, 22] } : ({} as RearDesign);
const SKIN = { base: "#d9a07a", shade: "#b98259", deep: "#a06c48", light: "#e8b998", blush: "#d98c7a", lipUp: "#b86a5e", lipLo: "#c4786a", lipHi: "#d99a8c" } as never;

/** Every head shape the sliders reach: all twelve face shapes at head width and length extremes. */
const heads = function* () {
  for (let face = 0; face < 12; face++) for (const headW of [0, 50, 100]) for (const headH of [0, 100]) yield { face, headW, headH };
};
const input = (a: Partial<Appearance>) => {
  const m = nextModelFor({ ...base, ...a }, 26, "#c8102e", "#f1ead8");
  const head = buildHeadNext(m.f);
  return { m, head, hair: { f: m.f, head, color: "#3e281a", skin: SKIN, uid: "t", d: 2 as const, recede: 0, seed: m.seed, tip: null, band: "#2255aa" } };
};

describe("Nordic Sweep", () => {
  it("is registered once with its generic name", () => {
    expect(HAIR_LIBRARY.filter((h) => h.id === "nordic-sweep")).toHaveLength(1);
    expect(HAIR_LIBRARY.find((h) => h.id === "nordic-sweep")?.name).toBe("Nordic Sweep");
  });

  it("renders every hair colour, deterministically, with valid geometry", () => {
    for (let c = 0; c < HAIR_COLORS.length; c++) {
      const svg = render({ hairColor: c }, 2);
      expect(svg.toLowerCase()).toContain(HAIR_COLORS[c]);
      expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    }
    for (const d of [0, 1, 2] as const) expect(render({}, d)).toBe(render({}, d));
    expect(render({ aging: 10 }, 2)).not.toBe(render({ aging: 80 }, 2));
  });

  it("rear hair is continuous with the top: each contour leaves the skull at the top of the ear, never inside it", () => {
    for (const h of heads()) {
      const { m, head, hair } = input(h);
      const neck = neckSides(m.f);
      for (const mass of rearMasses(hair, REAR)) {
        const side = mass.s;
        // The upper origin sits on the head edge (within a unit of the top mass's own outline).
        expect(Math.abs(Math.abs(mass.edge[0][0] - 150) - head.half(mass.edge[0][1], side))).toBeLessThan(1.6);
        for (const p of mass.edge) {
          const x = Math.abs(p[0] - 150);
          // Never cuts inside the head or the neck, and never stands out like a wall.
          expect(x).toBeGreaterThanOrEqual(head.half(p[1], side) + 0.7);
          expect(x).toBeGreaterThanOrEqual(halfAt(side > 0 ? neck.right : neck.left, p[1]) + 2.9);
          expect(x - head.half(Math.min(p[1], m.f.jawY - 18), side)).toBeLessThan(40);
        }
      }
    }
  });

  it("has no rectangular steps: neighbouring points never jump sideways, and the outline flows monotonically down", () => {
    for (const h of heads()) {
      const { hair } = input(h);
      for (const mass of rearMasses(hair, REAR)) {
        for (let j = 1; j < mass.edge.length; j++) {
          expect(mass.edge[j][1]).toBeGreaterThan(mass.edge[j - 1][1]);
          expect(Math.abs(mass.edge[j][0] - mass.edge[j - 1][0])).toBeLessThan(4.5);
        }
        // Tapered lower end: the mass is much narrower at its tip than near the top.
        const w = (j: number) => Math.abs(mass.edge[j][0] - mass.inner[j][0]);
        expect(w(mass.edge.length - 1)).toBeLessThan(w(2) * 0.4);
      }
    }
  });

  it("fills the space beside the jaw: the outermost mass never leaves a gap wider than the pad next to the head or neck", () => {
    for (const h of heads()) {
      const { m, head, hair } = input(h);
      const neck = neckSides(m.f);
      for (const mass of rearMasses(hair, REAR).filter((q) => q.k === 0)) {
        for (const p of mass.edge) {
          if (p[1] < m.f.ear.top || p[1] > SHIRT_Y) continue;
          const x = Math.abs(p[0] - 150);
          const nearest = Math.max(head.half(p[1], mass.s), halfAt(mass.s > 0 ? neck.right : neck.left, p[1]));
          expect(x - nearest).toBeLessThan(48);
        }
      }
    }
  });

  it("adapts to the head: rear hair is wider on a broad head than on a narrow one, and the two sides differ", () => {
    const outer = (a: Partial<Appearance>) => {
      const { hair } = input(a);
      const m = rearMasses(hair, REAR).filter((q) => q.k === 0);
      const at = (q: (typeof m)[number]) => Math.abs(q.edge[Math.floor(q.edge.length * 0.5)][0] - 150);
      return { right: at(m.find((q) => q.s > 0)!), left: at(m.find((q) => q.s < 0)!) };
    };
    const narrow = outer({ face: 5, headW: 0, headH: 70 });
    const wide = outer({ face: 2, headW: 100, headH: 30 });
    expect(wide.right).toBeGreaterThan(narrow.right + 8);
    expect(Math.abs(narrow.left - narrow.right) + Math.abs(wide.left - wide.right)).toBeGreaterThan(0.05);
  });

  it("has no skin-tone fade under the mass (it reaches the ear), and stays as light as Long Flow at every size", () => {
    expect(render({}, 2)).not.toContain("skc");
    const flow = (d: 0 | 1 | 2) => count(renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m: { ...nextModelFor(base, 26, "#c8102e", "#f1ead8"), hairStyle: "long-flow" }, uid: "c", d }))));
    for (const d of [0, 1, 2] as const) expect(count(render({}, d))).toBeLessThanOrEqual(flow(d) + 6);
    expect(count(render({}, 0))).toBeLessThan(count(render({}, 2)));
  });

  it("copes with missing optional fields and an older player", () => {
    const a = { ...base } as Partial<Appearance>;
    delete a.hairTip;
    delete a.band;
    expect(() => render(a, 1)).not.toThrow();
    const old = renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m: { ...nextModelFor(base, 38, "#c8102e", "#f1ead8"), hairStyle: "nordic-sweep" }, uid: "o", d: 2 })));
    expect(old).not.toMatch(/NaN|Infinity/);
  });
});
