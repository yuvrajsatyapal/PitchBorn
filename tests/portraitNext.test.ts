import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PortraitNext } from "../src/components/art/portrait-next/art";
import { COLLARS, necklineFor } from "../src/components/art/portrait-next/kit";
import { nextModelFor } from "../src/components/art/portrait-next/model";
import { HAIR_LIBRARY } from "../src/components/art/portrait-next/hair";
import { halfAt, neckSides } from "../src/components/art/portrait-next/neck";
import { skinTones } from "../src/components/art/portrait-next/palette";
import { CX } from "../src/components/art/portrait/geometry";
import { generateAppearance } from "../src/engine/appearance/generate";
import type { Appearance } from "../src/engine/types";

const KIT = "#c8102e";
const TRIM = "#f1ead8";
const base: Appearance = { ...generateAppearance("neck"), hair: 0, facial: 0 };

/** Every neck width the sliders can produce: narrow to broad faces, head width extremes, a teenager to a veteran. */
const necks = function* () {
  for (let face = 0; face < 12; face++)
    for (const headW of [0, 50, 100])
      for (const headH of [0, 100])
        for (const age of [17, 26, 38]) yield { a: { ...base, face, headW, headH }, age };
};

describe("improved portrait: the neck goes into the shirt", () => {
  it("the collar opening always clears the neck, so the clip only trims its bottom, never its sides", () => {
    for (const { a, age } of necks()) {
      const m = nextModelFor(a, age, KIT, TRIM);
      const { left, right } = neckSides(m.f);
      for (const collar of COLLARS) {
        const line = necklineFor(m.f, collar);
        for (let y = line.y - 24; y <= line.y; y += 2) {
          expect(halfAt(left, y)).toBeLessThan(line.open);
          expect(halfAt(right, y)).toBeLessThan(line.open);
        }
        // The front of the collar dips below the side points and stays inside the opening.
        for (const p of line.frontIn) {
          expect(p[1]).toBeGreaterThanOrEqual(line.y - 1e-6);
          expect(Math.abs(p[0] - CX)).toBeLessThanOrEqual(line.open + 1e-6);
        }
        // The ring is closed: front and back of the collar meet at the same side points.
        expect(line.frontIn[0]).toEqual(line.backIn[0]);
        expect(line.frontIn[line.frontIn.length - 1]).toEqual(line.backIn[line.backIn.length - 1]);
      }
    }
  });

  it("draws the shirt back, then the clipped neck, then the front of the collar, then the head", () => {
    for (const collar of COLLARS) {
      for (const d of [0, 1, 2] as const) {
        const m = { ...nextModelFor({ ...base, face: 6, headW: 100 }, 26, KIT, TRIM), collar };
        const svg = renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m, uid: "t", d })));
        const skin = skinTones(m.skin).base;
        const body = svg.indexOf(`fill="${KIT}"`);
        const neck = svg.indexOf('clip-path="url(#tnv)"');
        const firstSkin = svg.indexOf(`fill="${skin}"`);
        const front = svg.indexOf(`fill="${TRIM}"`);
        const head = svg.indexOf('href="#thp" fill=');
        expect(body).toBeGreaterThan(-1);
        expect(neck).toBeGreaterThan(body);
        // No skin is painted anywhere before the neck's clip begins.
        expect(firstSkin).toBeGreaterThan(neck);
        expect(front).toBeGreaterThan(firstSkin);
        expect(head).toBeGreaterThan(front);
      }
    }
  });
});

describe("improved portrait: hair designs", () => {
  const renderHair = (hairStyle: string, d: 0 | 1 | 2, uid = "h") =>
    renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m: { ...nextModelFor({ ...base, face: 9 }, 26, KIT, TRIM), hairStyle }, uid, d })));

  it("every design draws with the new techniques and is deterministic for the same player", () => {
    for (const h of HAIR_LIBRARY) {
      for (const d of [0, 1, 2] as const) {
        const a = renderHair(h.id, d);
        expect(a).toBe(renderHair(h.id, d));
        expect(a.length).toBeGreaterThan(1000);
      }
    }
  });

  it("small portraits stay light: fewer elements than close-ups", () => {
    for (const h of HAIR_LIBRARY) {
      const count = (s: string) => (s.match(/<(path|circle|rect|use|ellipse)\b/g) ?? []).length;
      expect(count(renderHair(h.id, 0))).toBeLessThan(count(renderHair(h.id, 2)));
    }
  });
});
