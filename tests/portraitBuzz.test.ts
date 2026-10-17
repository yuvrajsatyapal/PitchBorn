import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PortraitNext } from "../src/components/art/portrait-next/art";
import { HAIR_LIBRARY, drawHair } from "../src/components/art/portrait-next/hair";
import { buildHeadNext } from "../src/components/art/portrait-next/head";
import { nextModelFor } from "../src/components/art/portrait-next/model";
import { generateAppearance } from "../src/engine/appearance/generate";
import { HAIR_COLORS } from "../src/engine/appearance/options";
import type { Appearance } from "../src/engine/types";

const base: Appearance = { ...generateAppearance("buzz"), facial: 0, accessory: 0, scar: 0, mark: 0 };
const render = (a: Partial<Appearance>, d: 0 | 1 | 2, uid = "z") =>
  renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m: { ...nextModelFor({ ...base, ...a }, 26, "#c8102e", "#f1ead8"), hairStyle: "golden-buzz" }, uid, d })));
const count = (s: string) => (s.match(/<(path|circle|rect|use|ellipse)\b/g) ?? []).length;

describe("Golden Buzz", () => {
  it("is registered once, generically named, and iconic", () => {
    expect(HAIR_LIBRARY.filter((h) => h.id === "golden-buzz")).toHaveLength(1);
    expect(HAIR_LIBRARY.find((h) => h.id === "golden-buzz")?.name).toBe("Golden Buzz");
  });

  it("never hardcodes a colour: every hair colour renders its own tone", () => {
    for (let c = 0; c < HAIR_COLORS.length; c++) {
      const svg = render({ hairColor: c }, 2);
      expect(svg.toLowerCase()).toContain(HAIR_COLORS[c]);
      expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it("is deterministic per player, and different players differ only slightly", () => {
    for (const d of [0, 1, 2] as const) expect(render({}, d)).toBe(render({}, d));
    expect(render({ aging: 10 }, 2)).not.toBe(render({ aging: 80 }, 2));
  });

  it("stays low-profile: the hair stands only a few units off the skull on every head shape", () => {
    for (let face = 0; face < 12; face++) {
      for (const headW of [0, 100]) {
        for (const headH of [0, 100]) {
          const m = nextModelFor({ ...base, face, headW, headH }, 26, "#c8102e", "#f1ead8");
          const head = buildHeadNext(m.f);
          const art = drawHair("golden-buzz", { f: m.f, head, color: "#3e281a", skin: { base: "#d9a07a", shade: "#b98259", deep: "#a06c48", light: "#e8b998", blush: "#d98c7a", lipUp: "#b86a5e", lipLo: "#c4786a", lipHi: "#d99a8c" } as never, uid: "t", d: 2, recede: 0, seed: m.seed, tip: null, band: "#2255aa" });
          // Measured where the skull is widest, where horizontal growth equals the hair's thickness.
          const y = m.f.top + (m.f.browY - m.f.top) * 0.45;
          const rise = (art?.extent?.(y, 1) ?? 0) - head.half(y, 1);
          expect(rise).toBeGreaterThan(0);
          expect(rise).toBeLessThan(5);
        }
      }
    }
  });

  it("is lighter than the full textured crop at every size and lighter still when small", () => {
    const crop = HAIR_LIBRARY.find((h) => h.id === "textured-crop")!.id;
    const cropCount = (d: 0 | 1 | 2) => count(renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m: { ...nextModelFor(base, 26, "#c8102e", "#f1ead8"), hairStyle: crop }, uid: "c", d }))));
    for (const d of [0, 1, 2] as const) expect(count(render({}, d))).toBeLessThanOrEqual(cropCount(d));
    expect(count(render({}, 0))).toBeLessThan(count(render({}, 2)));
  });

  it("copes with missing optional fields and with a receding hairline", () => {
    const a = { ...base } as Partial<Appearance>;
    delete a.hairTip;
    delete a.band;
    expect(() => render(a, 1)).not.toThrow();
    const old = renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m: { ...nextModelFor(base, 38, "#c8102e", "#f1ead8"), hairStyle: "golden-buzz" }, uid: "o", d: 2 })));
    expect(old).not.toMatch(/NaN|Infinity/);
  });
});
