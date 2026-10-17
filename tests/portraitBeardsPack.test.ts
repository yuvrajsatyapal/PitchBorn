/**
 * Imperial Goatee, Sharp Chinstrap, Maestro Beard and Rising Stubble: registered after the sixteen original styles
 * (editor only), fitted to every face from its own anchors, clear of the lips, deterministic, colour-true, light at 48px.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { anchorsFor } from "../src/components/art/portrait-next/anchors";
import { PortraitNext } from "../src/components/art/portrait-next/art";
import { burnY } from "../src/components/art/portrait-next/beardGeometry";
import { BEARD_LIMIT_Y, massFor } from "../src/components/art/portrait-next/beardMass";
import { growthFor } from "../src/components/art/portrait-next/facialHair";
import { buildHeadNext } from "../src/components/art/portrait-next/head";
import { withDetail } from "../src/components/art/portrait-next/ink";
import { nextModelFor } from "../src/components/art/portrait-next/model";
import { skinTones } from "../src/components/art/portrait-next/palette";
import { CX, inside, type Pt } from "../src/components/art/portrait/geometry";
import { appearanceKey, generateAppearance, sanitizeAppearance } from "../src/engine/appearance/generate";
import { APPEARANCE_KEYS, COUNTS, FACIAL_HAIR, HAIR_COLORS, HAIR_STYLES, SKIN_TONES } from "../src/engine/appearance/options";
import type { Appearance } from "../src/engine/types";

const IMPERIAL = FACIAL_HAIR.indexOf("Imperial Goatee");
const STRAP = FACIAL_HAIR.indexOf("Sharp Chinstrap");
const MAESTRO = FACIAL_HAIR.indexOf("Maestro Beard");
const RISING = FACIAL_HAIR.indexOf("Rising Stubble");
const NEW = [IMPERIAL, STRAP, MAESTRO, RISING];

const base: Appearance = { ...generateAppearance("beards-pack"), hair: 7, facial: 0, accessory: 0, scar: 0, mark: 0, freckles: 0, hairTip: 0, band: 0 };
const render = (a: Partial<Appearance>, d: 0 | 1 | 2, age = 26) => renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m: nextModelFor({ ...base, ...a }, age, "#7a1f2b", "#f1ead8"), uid: "q", d })));
const elements = (s: string) => (s.match(/<(path|circle|rect|use|ellipse)\b/g) ?? []).length;
const hair = (re: RegExp) => HAIR_STYLES.findIndex((h) => re.test(h.name));

const FACES: Partial<Appearance>[] = [];
for (let face = 0; face < COUNTS.face; face++) for (const [headW, headH] of [[0, 0], [100, 100], [50, 50]]) FACES.push({ face, headW, headH });

const inputFor = (a: Partial<Appearance>) => {
  const m = nextModelFor({ ...base, ...a }, 26, "#7a1f2b", "#f1ead8");
  const head = buildHeadNext(m.f);
  return { f: m.f, head, anchors: anchorsFor(m.f, head) };
};
const finite = (pts: readonly Pt[]) => pts.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

describe("registry", () => {
  it("appends four unique names after the original sixteen, so no stored index moves", () => {
    expect(NEW).toEqual([16, 17, 18, 19]);
    expect(FACIAL_HAIR.length).toBe(20);
    expect(new Set(FACIAL_HAIR).size).toBe(FACIAL_HAIR.length);
    expect(FACIAL_HAIR[15]).toBe("Chinstrap");
    expect(COUNTS.facial).toBe(20);
  });

  it("serialises: the stored value survives sanitising and the appearance key", () => {
    for (const facial of NEW) {
      const a = sanitizeAppearance({ ...base, facial });
      expect(a.facial).toBe(facial);
      expect(appearanceKey(a).split(".")[APPEARANCE_KEYS.indexOf("facial")]).toBe(String(facial));
    }
    expect(sanitizeAppearance({ ...base, facial: 99 }).facial).toBe(19);
  });

  it("the generator never hands the new styles out (rarity and saved looks unchanged)", () => {
    for (let i = 0; i < 1500; i++) expect(generateAppearance(`rar-${i}`).facial).toBeLessThan(16);
  });
});

describe("shapes follow each face", () => {
  it("every shape is finite, below the nose, inside the head's width plus hair thickness, and above the collar", () => {
    for (const fa of FACES) {
      const { f, head, anchors } = inputFor(fa);
      for (const d of [0, 2] as const) {
        withDetail(d, () => {
          for (const kind of ["imperial", "maestro"] as const) {
            const mass = massFor(kind, f, head, anchors, 7);
            for (const set of [mass.pts, mass.upper, mass.lower]) expect(finite(set)).toBe(true);
            expect(Math.min(...mass.pts.filter((p) => Math.abs(p[0] - CX) < 2 * f.nose.w).map((p) => p[1]))).toBeGreaterThan(f.noseY - 2);
            expect(Math.max(...mass.pts.map((p) => p[1]))).toBeLessThanOrEqual(Math.max(BEARD_LIMIT_Y, f.chinY + 10) + 3);
            for (const p of mass.pts) expect(Math.abs(p[0] - CX)).toBeLessThan(Math.max(head.half(Math.min(p[1], f.chinY), p[0] > CX ? 1 : -1) + 22, f.chinW + 24));
          }
          for (const style of [IMPERIAL, STRAP]) for (const g of growthFor(f, head, anchors, style)) expect(finite(g.pts)).toBe(true);
        });
      }
    }
  });

  it("keeps the lips clear: no moustache, connector or chin shape covers the mouth", () => {
    for (const fa of FACES) {
      const { f, head, anchors } = inputFor(fa);
      const probes: Pt[] = [[CX, f.mouthY], [CX - f.mouth.w + 3, f.mouthY], [CX + f.mouth.w - 3, f.mouthY], [CX, f.mouthY + f.mouth.lo - 1], [CX, f.mouthY - f.mouth.up + 1]];
      withDetail(2, () => {
        const shapes: Pt[][] = [massFor("imperial", f, head, anchors, 7).pts, ...growthFor(f, head, anchors, IMPERIAL).map((g) => g.pts), ...growthFor(f, head, anchors, STRAP).map((g) => g.pts)];
        for (const s of shapes) for (const p of probes) expect(inside(s, p)).toBe(false);
      });
    }
  });

  it("the imperial goatee leaves the cheeks and jaw clean: connectors hug the mouth corners, the tuft stays inside the chin", () => {
    for (const fa of FACES) {
      const { f, head, anchors } = inputFor(fa);
      withDetail(2, () => {
        const mass = massFor("imperial", f, head, anchors, 7);
        for (const p of mass.pts) {
          expect(Math.abs(p[0] - CX)).toBeLessThan(f.mouth.w + 8);
          if (p[1] > f.mouthY + f.mouth.lo + 8) expect(Math.abs(p[0] - CX)).toBeLessThan(f.chinW + 8);
        }
        const must = growthFor(f, head, anchors, IMPERIAL)[0];
        const reach = Math.max(...must.pts.map((p) => Math.abs(p[0] - CX)));
        expect(reach).toBeGreaterThan(f.mouth.w);
        expect(reach).toBeLessThan(f.mouth.w + 12);
        // The tuft hangs below the chin outline.
        expect(Math.max(...mass.pts.map((p) => p[1]))).toBeGreaterThan(f.chinY + 2);
        // ...but only a little: a compact tuft, not an extension that follows the face length.
        expect(Math.max(...mass.pts.map((p) => p[1]))).toBeLessThan(f.chinY + 8);
      });
    }
  });

  it("the sharp chinstrap is one thin, closed band that starts at the sideburn and meets at the chin", () => {
    for (const fa of FACES) {
      const { f, head, anchors } = inputFor(fa);
      withDetail(2, () => {
        const list = growthFor(f, head, anchors, STRAP);
        expect(list).toHaveLength(1);
        const g = list[0];
        const ys = g.pts.map((p) => p[1]);
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(burnY(f) - 3);
        expect(Math.max(...ys)).toBeLessThan(f.chinY + 4);
        const half = g.pts.length / 2;
        const outer = g.pts.slice(0, half);
        const inner = g.pts.slice(half).reverse();
        for (let i = 0; i < outer.length; i += 3) {
          const w = Math.hypot(outer[i][0] - inner[Math.min(inner.length - 1, i)][0], outer[i][1] - inner[Math.min(inner.length - 1, i)][1]);
          expect(w).toBeGreaterThan(1.5);
          expect(w).toBeLessThan(9);
        }
        expect(outer.some((p) => Math.abs(p[0] - CX) < 4 && p[1] > f.chinY - 3)).toBe(true);
        for (const p of outer) if (p[1] < f.chinY - 1) expect(Math.abs(p[0] - CX)).toBeLessThan(head.half(p[1], p[0] > CX ? 1 : -1) + 4);
      });
    }
  });

  it("the maestro beard hangs a medium length below the chin, never as long as the long beard", () => {
    for (const fa of FACES) {
      const { f, head, anchors } = inputFor(fa);
      withDetail(2, () => {
        const bottom = Math.max(...massFor("maestro", f, head, anchors, 7).pts.map((p) => p[1]));
        expect(bottom - f.chinY).toBeGreaterThan(5);
        expect(bottom - f.chinY).toBeLessThan(24);
        expect(Math.max(...massFor("long", f, head, anchors, 7).pts.map((p) => p[1]))).toBeGreaterThan(bottom);
      });
    }
  });

  it("different seeds vary the shape slightly but never its category", () => {
    const { f, head, anchors } = inputFor({ face: 0 });
    withDetail(2, () => {
      const a = massFor("maestro", f, head, anchors, 3);
      const b = massFor("maestro", f, head, anchors, 400);
      expect(JSON.stringify(a.pts)).not.toBe(JSON.stringify(b.pts));
      for (const m of [a, b]) {
        expect(Math.max(...m.pts.map((p) => p[1])) - f.chinY).toBeGreaterThan(9);
        expect(inside(m.pts, [CX, f.chinY + 3])).toBe(true);
      }
    });
  });
});

describe("rendering", () => {
  it("draws valid, deterministic artwork on every face at every size", () => {
    for (const fa of FACES.slice(0, 20)) {
      for (const facial of NEW) {
        for (const d of [0, 1, 2] as const) {
          const svg = render({ ...fa, facial }, d);
          expect(svg).not.toMatch(/NaN|Infinity|undefined/);
          for (const m of svg.matchAll(/\sd="([^"]*)"/g)) expect(m[1]).toMatch(/^M[-\d.\s,MLHVCSQTAZmlhvcsqtaz]*$/);
          expect(svg).toBe(render({ ...fa, facial }, d));
        }
      }
    }
  });

  it("each new style differs from clean shaven, from each other and from its nearest existing style", () => {
    const out = NEW.map((facial) => render({ facial }, 2));
    for (const s of out) expect(s).not.toBe(render({ facial: 0 }, 2));
    expect(new Set(out).size).toBe(4);
    for (const [i, existing] of [[0, 3], [0, 6], [1, 15], [1, 8], [2, 10], [2, 8], [3, 1]]) expect(out[i]).not.toBe(render({ facial: existing }, 2));
  });

  it("the per-player seed varies each new style, and the same player always draws the same beard", () => {
    for (const facial of NEW) {
      expect(render({ facial, aging: 20 }, 2)).not.toBe(render({ facial, aging: 80 }, 2));
      expect(render({ facial, aging: 20 }, 2)).toBe(render({ facial, aging: 20 }, 2));
    }
  });

  it("every beard colour draws every new style in its own colour, on light and dark skin, without touching the skin", () => {
    for (const facial of NEW) {
      const seen = new Set<string>();
      for (let c = 0; c < HAIR_COLORS.length; c++) {
        for (const skin of [1, 8]) {
          const svg = render({ facial, facialColor: c, hairColor: c, skin }, 2);
          expect(svg).not.toMatch(/NaN|undefined/);
          expect(svg).toContain(`fill="${skinTones(SKIN_TONES[skin]).base}"`);
          if (skin === 1) seen.add(svg);
        }
      }
      expect(seen.size).toBe(HAIR_COLORS.length);
    }
  });

  it("works with the existing hairstyles and accessories", () => {
    const hairs = [/short textured/i, /crown taper/i, /slickback/i, /nordic sweep/i, /warrior knot/i, /medium afro/i, /long flow/i].map(hair).filter((i) => i >= 0);
    expect(hairs.length).toBeGreaterThanOrEqual(4);
    for (const facial of NEW) {
      for (const h of hairs) {
        for (const accessory of [0, 1, 2, 3]) expect(render({ facial, hair: h, accessory, face: 6, headW: 100, scar: 1, mark: 1 }, 2)).not.toMatch(/NaN|undefined/);
      }
    }
  });

  it("stays light at 48px, with every accessory, on a wide face", () => {
    const failures: string[] = [];
    for (const facial of NEW) {
      for (let accessory = 0; accessory < COUNTS.accessory; accessory++) {
        for (const h of [0, 7, hair(/medium afro/i)]) {
          const svg = render({ facial, accessory, hair: h, face: 6, headW: 100 }, 0);
          if (svg.length > 20_000 || elements(svg) > 110) failures.push(`${facial}/${accessory}/${h}: ${svg.length} chars, ${elements(svg)} elements`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("stays within a budget at 96px and large sizes", () => {
    for (const facial of NEW) {
      expect(elements(render({ facial }, 1))).toBeLessThanOrEqual(190);
      expect(elements(render({ facial }, 2))).toBeLessThanOrEqual(260);
    }
  });

  it("rising stubble adds only a few shapes at 48px and is not the light-stubble wash", () => {
    expect(elements(render({ facial: RISING }, 0)) - elements(render({ facial: 0 }, 0))).toBeLessThanOrEqual(14);
    expect(render({ facial: RISING }, 2)).not.toBe(render({ facial: 1 }, 2));
  });
});
