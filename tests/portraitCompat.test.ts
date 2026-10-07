/**
 * Portrait compatibility: every face shape and slider with every hairstyle (iconic included), facial hair and
 * accessory draws valid, deterministic artwork fitted to that face; iconic styles stay rare; new options load from
 * old saves.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlayerPortrait } from "../src/components/art/PlayerPortrait";
import { anchorsFor } from "../src/components/art/portrait-next/anchors";
import { PortraitNext, detailFor } from "../src/components/art/portrait-next/art";
import { HAIR_LIBRARY, POC_IDS, hairMeta } from "../src/components/art/portrait-next/hair";
import { buildHeadNext } from "../src/components/art/portrait-next/head";
import { nextModelFor } from "../src/components/art/portrait-next/model";
import { CX } from "../src/components/art/portrait/geometry";
import { generateAppearance, sanitizeAppearance, supportsHairTips } from "../src/engine/appearance/generate";
import { APPEARANCE_KEYS, BAND_COLORS, COUNTS, FACIAL_HAIR, HAIR_COLORS, HAIR_STYLES, HAIR_TIP_COLORS } from "../src/engine/appearance/options";
import type { Appearance } from "../src/engine/types";
import { decodeState, encodeState } from "../src/persistence/codec";
import { newCareer } from "./helpers";

const KIT = "#7a1f2b";
const TRIM = "#f1ead8";
const base: Appearance = { ...generateAppearance("compat"), hair: 0, facial: 0, accessory: 0, scar: 0, mark: 0, freckles: 0, hairTip: 0, band: 0 };
const ICONIC_NAMES = ["Brazilian Crescent", "Frosted Faux Hawk", "Long Headband Curls", "Lion Afro", "Divine Ponytail", "Dutch Dreads"];
const iconicIndex = (name: string) => HAIR_STYLES.findIndex((h) => h.name === name);

const render = (a: Partial<Appearance>, d: 0 | 1 | 2, age = 26, uid = "c") =>
  renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m: nextModelFor({ ...base, ...a }, age, KIT, TRIM), uid, d })));

/** Markup a browser will draw: no NaN or Infinity anywhere, and every path is well-formed path data. */
function expectValid(svg: string) {
  expect(svg).not.toMatch(/NaN|Infinity|undefined/);
  for (const m of svg.matchAll(/\sd="([^"]*)"/g)) {
    expect(m[1]).toMatch(/^M[-\d.\s,MLHVCSQTAZmlhvcsqtaz]*$/);
  }
}

/** Faces covering the shape list and the slider extremes. */
const FACES: Partial<Appearance>[] = [
  { face: 0 },
  { face: 1, headW: 70, headH: 0 },
  { face: 2, headW: 100 },
  { face: 4, eyeSp: 0, noseSc: 100 },
  { face: 5, headW: 0, headH: 50 },
  { face: 6, headW: 100, headH: 40, earSc: 100 },
  { face: 7, headW: 30, headH: 100 },
  { face: 9, browAng: 100, eyeSp: 100 },
  { face: 11, headW: 0, headH: 0, earSc: 0 },
];
const NEW_DESIGN_HAIR = Object.keys(POC_IDS).map(Number);

describe("portrait compatibility: semantic anchors", () => {
  it("every face shape, slider extreme and age gives finite anchors in anatomical order", () => {
    for (let face = 0; face < 12; face++)
      for (const headW of [0, 100])
        for (const headH of [0, 100])
          for (const age of [17, 38]) {
            const m = nextModelFor({ ...base, face, headW, headH, eyeSp: headW, earSc: headH }, age, KIT, TRIM);
            const a = anchorsFor(m.f, buildHeadNext(m.f));
            const numbers = (v: unknown): number[] => (typeof v === "number" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(numbers) : []);
            const all = numbers(a);
            expect(all.length).toBeGreaterThan(60);
            for (const n of all) expect(Number.isFinite(n)).toBe(true);
            const ys = [a.headTop, a.foreheadTop, a.browL, a.eyeL, a.noseBase, a.mouth, a.chin].map((p) => p[1]);
            for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
            // The neck enters the shirt below the jaw (a long chin may hang in front of the collar).
            expect(a.neckBase[1]).toBeGreaterThan(Math.max(a.jawL[1], a.jawR[1]));
            for (const [l, r] of [[a.templeL, a.templeR], [a.eyeL, a.eyeR], [a.mouthL, a.mouthR], [a.jawL, a.jawR], [a.cheekL, a.cheekR], [a.neckL, a.neckR]]) {
              expect(l[0]).toBeLessThan(CX);
              expect(r[0]).toBeGreaterThan(CX);
            }
            for (const ear of [a.earL, a.earR]) {
              expect(ear.top[1]).toBeLessThan(ear.center[1]);
              expect(ear.center[1]).toBeLessThan(ear.bottom[1]);
            }
            // Ears sit outside the eyes; glasses arms run from the eyes to them.
            expect(a.earL.root).toBeLessThan(a.eyeL[0] - a.eyeW);
            expect(a.earR.root).toBeGreaterThan(a.eyeR[0] + a.eyeW);
          }
  });
});

describe("portrait compatibility: every combination draws", () => {
  it("each hairstyle with a new design, on every face and at every size, is valid and deterministic", () => {
    for (const hair of [...NEW_DESIGN_HAIR, 3, 15, 33]) {
      FACES.forEach((fa, i) => {
        for (const d of [0, 1, 2] as const) {
          const a = { ...fa, hair, hairTip: i % 3 ? 2 : 0, band: i % COUNTS.band };
          const svg = render(a, d);
          expectValid(svg);
          if (i === 0) expect(render(a, d)).toBe(svg);
        }
      });
    }
  });

  it("each facial hair style fits every face", () => {
    for (let facial = 0; facial < FACIAL_HAIR.length; facial++) {
      FACES.forEach((fa, i) => {
        for (const d of [0, 2] as const) {
          const svg = render({ ...fa, facial, hair: NEW_DESIGN_HAIR[i % NEW_DESIGN_HAIR.length] }, d, 30);
          expectValid(svg);
        }
      });
      // Every style other than clean shaven adds something to the face.
      if (facial > 0) expect(render({ facial }, 2, 30)).not.toBe(render({ facial: 0 }, 2, 30));
    }
  });

  it("each accessory and mark draws with every new hair design", () => {
    for (const hair of NEW_DESIGN_HAIR)
      for (let accessory = 0; accessory < COUNTS.accessory; accessory++)
        for (const d of [0, 2] as const) expectValid(render({ face: 6, headW: 100, hair, accessory, band: 3, freckles: 1, scar: (hair + accessory) % COUNTS.scar, mark: hair % COUNTS.mark }, d));
  });

  it("the current renderer still draws every option, including the new ones", () => {
    for (let hair = 0; hair < COUNTS.hair; hair++) {
      const svg = renderToStaticMarkup(createElement(PlayerPortrait, { appearance: { ...base, hair, hairTip: hair % COUNTS.hairTip, band: hair % COUNTS.band, accessory: hair % COUNTS.accessory }, age: 25, size: 120, kit: KIT }));
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });

  // Budget for a 48px portrait. Every hairstyle must fit it: a style that doesn't gets a lighter small-size version
  // (fewer, larger shapes via the level of detail), never a bigger budget.
  const MAX_CHARS_48 = 20_000;
  const MAX_ELEMENTS_48 = 110;
  const elements = (s: string) => (s.match(/<(path|circle|rect|use|ellipse)\b/g) ?? []).length;

  it("small portraits of the iconic styles stay light and are lighter than the large ones", () => {
    for (const name of ICONIC_NAMES) {
      const small = render({ hair: iconicIndex(name), hairTip: 2 }, 0);
      const large = render({ hair: iconicIndex(name), hairTip: 2 }, 2);
      expect(elements(small)).toBeLessThan(elements(large));
      expect(small.length).toBeLessThan(large.length);
    }
  });

  it("every hairstyle fits the 48px budget (reports all failures at once)", () => {
    const failures: string[] = [];
    HAIR_STYLES.forEach((h, hair) => {
      const svg = render({ hair, hairTip: supportsHairTips(hair) ? 2 : 0 }, detailFor(48));
      if (svg.length > MAX_CHARS_48 || elements(svg) > MAX_ELEMENTS_48) failures.push(`${h.name}: ${svg.length} chars, ${elements(svg)} elements`);
    });
    expect(failures).toEqual([]);
  });
});

describe("portrait compatibility: random stress", () => {
  it("300 generated players draw valid artwork with anchors at every size", () => {
    for (let i = 0; i < 300; i++) {
      const a = generateAppearance(`rand-${i}`);
      const age = 17 + (i % 22);
      const m = nextModelFor({ ...a, accessory: i % COUNTS.accessory }, age, KIT, TRIM);
      const anchors = anchorsFor(m.f, buildHeadNext(m.f));
      for (const p of [anchors.headTop, anchors.eyeL, anchors.eyeR, anchors.mouth, anchors.chin, anchors.earL.top, anchors.earR.bottom, anchors.neckBase]) {
        expect(Number.isFinite(p[0]) && Number.isFinite(p[1])).toBe(true);
      }
      for (const d of [0, 1, 2] as const) {
        const svg = renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m, uid: `r${i}`, d })));
        expectValid(svg);
        expect(svg).not.toContain('d=""');
      }
    }
  });
});

describe("portrait compatibility: hair metadata", () => {
  it("every option index with a new design maps to a library entry, and every entry is reachable", () => {
    const ids = new Set(Object.values(POC_IDS));
    for (const id of ids) expect(hairMeta(id!)).toBeTruthy();
    for (const h of HAIR_LIBRARY) expect(ids.has(h.id)).toBe(true);
  });

  it("the iconic styles are exactly the six generic designs, flagged in both the options and the library", () => {
    expect(HAIR_STYLES.filter((h) => h.iconic).map((h) => h.name)).toEqual(ICONIC_NAMES);
    for (const name of ICONIC_NAMES) {
      const meta = hairMeta(POC_IDS[iconicIndex(name)]!);
      expect(meta?.name).toBe(name);
      expect(meta?.category).toBe("iconic");
      expect(meta?.rarity).toBe("legendary");
    }
    // Iconic styles come after every everyday style, so stored indices of everyday styles never moved.
    const first = HAIR_STYLES.findIndex((h) => h.iconic);
    expect(HAIR_STYLES.slice(first).every((h) => h.iconic)).toBe(true);
  });

  it("ear and headband rules are consistent", () => {
    for (const h of HAIR_LIBRARY) {
      expect(h.supportsEarrings).toBe(h.ears !== "covered");
      expect(h.ownHeadband).toBe(h.id === "long-headband-curls");
    }
  });
});

describe("portrait compatibility: accessories", () => {
  const STUD = 'fill="#e8d28a"';
  it("an ear stud shows only where the hair leaves the ear visible", () => {
    for (const [index, id] of Object.entries(POC_IDS)) {
      const svg = render({ hair: Number(index), accessory: 2 }, 2);
      expect(svg.includes(STUD)).toBe(hairMeta(id!)!.ears !== "covered");
    }
  });

  it("a style with its own headband never gets a second one from the accessory", () => {
    const hair = iconicIndex("Long Headband Curls");
    const blue = `fill="${BAND_COLORS[3]}"`;
    const count = (s: string) => s.split(blue).length - 1;
    const own = render({ hair, band: 3 }, 2);
    expect(count(own)).toBeGreaterThan(0);
    expect(count(render({ hair, band: 3, accessory: 1 }, 2))).toBe(count(own));
    // Any other style gets the accessory band in the chosen colour.
    expect(count(render({ hair: 7, band: 3, accessory: 1 }, 2))).toBeGreaterThan(0);
  });

  it("glasses are drawn on every face, sized from each face's eyes", () => {
    const lens = (svg: string) => svg.match(/<path d="([^"]+)" fill="#dbe9ee"/)?.[1];
    for (const fa of FACES) expect(lens(render({ ...fa, accessory: 3 }, 2))).toBeTruthy();
    expect(lens(render({ face: 5, headW: 0, eyeSp: 0, accessory: 3 }, 2))).not.toBe(lens(render({ face: 6, headW: 100, eyeSp: 100, accessory: 3 }, 2)));
  });
});

describe("portrait compatibility: generation", () => {
  // Looks generated before the iconic styles and second colours were added (first 24 values of each).
  const GOLDEN: Record<number, string> = {
    0: "5.2.0.2.5.2.7.1.3.1.9.2.0.0.0.0.0.38.62.59.62.65.20.78", 1: "7.2.8.1.6.1.5.1.3.0.5.1.1.0.0.0.0.31.78.37.66.33.6.62",
    2: "5.5.9.1.2.1.5.1.9.8.2.0.2.0.0.0.0.72.33.50.16.59.61.32", 3: "8.4.26.0.1.0.3.0.9.5.2.0.0.0.0.0.0.32.48.58.62.62.57.4",
    4: "3.9.33.8.4.8.5.1.5.7.8.8.2.0.0.2.0.53.32.76.40.63.74.81", 5: "9.8.10.2.4.2.6.0.6.4.5.2.2.0.0.0.0.23.46.36.37.46.51.86",
    6: "7.0.8.1.4.1.2.0.0.0.7.0.1.0.0.0.0.57.50.56.30.68.54.3", 7: "8.11.14.1.8.1.5.1.11.4.2.1.2.0.0.0.0.51.42.38.48.46.24.33",
    8: "2.7.2.1.6.1.1.5.3.7.1.1.2.0.0.0.0.61.33.14.43.52.54.79", 9: "2.0.4.4.8.4.1.1.5.8.10.4.1.0.0.0.0.63.71.79.42.53.36.74",
    10: "0.6.19.5.2.5.1.0.0.8.8.5.2.0.0.0.0.32.58.71.41.72.62.47", 11: "5.10.1.3.4.3.3.0.7.8.0.3.0.0.0.0.0.57.31.56.31.60.44.28",
    12: "3.6.18.4.0.4.3.1.2.8.0.4.0.0.0.0.0.59.67.45.0.31.69.0", 13: "0.9.4.5.4.5.1.1.2.7.1.5.2.0.0.0.0.35.44.85.21.33.58.55",
    14: "8.5.19.0.9.0.2.2.2.4.0.0.1.0.0.0.0.100.81.44.19.62.54.24", 15: "3.4.10.4.5.4.3.1.0.8.10.4.0.0.0.2.0.63.34.41.19.58.76.4",
    16: "7.4.17.0.4.0.5.0.5.3.5.0.1.0.0.0.0.75.72.19.44.50.27.95", 17: "9.10.2.0.2.0.4.1.9.0.1.0.0.0.0.0.0.62.35.61.48.59.65.76",
    18: "1.10.27.3.4.3.0.1.2.4.3.3.0.0.0.0.0.50.31.35.59.71.22.25", 19: "2.0.36.1.6.1.5.1.1.8.8.1.0.0.0.0.2.48.31.38.27.33.62.42",
    20: "3.11.24.5.9.5.6.5.2.7.8.5.2.0.0.0.0.29.36.33.65.30.55.63", 21: "2.3.12.7.0.7.3.4.1.0.3.7.0.0.0.0.0.28.21.86.45.58.59.31",
    22: "6.11.2.2.4.2.7.2.8.4.6.2.1.0.0.1.0.73.62.47.53.53.22.32", 23: "5.7.4.0.9.0.1.1.4.0.2.1.2.0.0.0.1.77.44.50.20.22.62.51",
    24: "5.5.7.3.9.3.4.1.4.8.1.3.1.0.0.0.0.47.49.31.39.51.78.24", 25: "4.11.26.0.7.0.6.0.5.8.10.1.1.0.0.0.0.60.9.53.24.63.72.87",
    26: "7.2.4.0.6.0.1.1.3.5.0.0.1.0.0.0.0.85.48.0.37.37.62.14", 27: "7.10.13.1.6.1.1.0.5.8.8.1.2.0.0.0.0.60.30.48.66.28.17.50",
    28: "5.8.9.1.9.1.4.0.0.0.8.0.0.0.0.0.0.29.28.39.32.54.58.44", 29: "4.0.31.4.6.4.5.3.3.5.1.4.1.1.0.0.0.52.63.30.54.34.52.47",
    109: "1.6.12.8.7.8.7.1.5.4.0.8.1.0.0.0.0.49.27.2.28.42.27.76", 198: "7.7.8.3.4.3.6.1.8.5.8.2.2.0.0.0.0.54.60.100.4.37.37.11",
    200: "6.5.35.7.1.7.6.0.9.0.6.7.0.0.0.0.0.69.48.60.47.33.26.58", 289: "1.5.2.1.6.1.1.1.8.5.1.1.0.0.0.0.0.83.73.69.45.22.59.97",
    322: "0.6.24.2.3.2.2.4.6.7.0.2.1.0.0.0.0.43.18.44.27.42.50.33", 372: "7.7.33.1.0.0.3.1.6.8.1.1.0.0.0.0.0.49.53.49.16.62.42.97",
  };

  it("existing players keep their generated look; an iconic roll changes only the hairstyle", () => {
    let iconic = 0;
    let otherIconic = 0;
    let goldenLions = 0;
    for (const [i, key] of Object.entries(GOLDEN)) {
      const a = generateAppearance(`golden-${i}`);
      const now = APPEARANCE_KEYS.slice(0, 24).map((k) => a[k]);
      const was = key.split(".").map(Number);
      const changed = now.flatMap((v, j) => (v !== was[j] ? [APPEARANCE_KEYS[j]] : []));
      if (!HAIR_STYLES[a.hair].iconic) {
        expect(now).toEqual(was);
        continue;
      }
      iconic++;
      // An iconic roll replaces the hairstyle. Only a Lion Afro may also turn Golden; nothing else moves.
      if (HAIR_STYLES[a.hair].name === "Lion Afro") {
        expect(changed.filter((k) => k !== "hair" && k !== "hairColor")).toEqual([]);
        if (changed.includes("hairColor")) {
          expect(a.hairColor).toBe(HAIR_COLORS.indexOf("#d6a645"));
          goldenLions++;
        }
      } else {
        expect(changed).toEqual(["hair"]);
        otherIconic++;
      }
    }
    expect(iconic).toBeGreaterThan(0);
    expect(otherIconic).toBeGreaterThan(0);
    expect(goldenLions).toBeGreaterThan(0);
  });

  it("iconic styles are rare overall, all six occur, and squads rarely carry more than one", () => {
    const N = 20_000;
    const seen = new Map<string, number>();
    let total = 0;
    let crowded = 0;
    for (let squad = 0; squad < N / 25; squad++) {
      let inSquad = 0;
      for (let p = 0; p < 25; p++) {
        const h = HAIR_STYLES[generateAppearance(`club-${squad}-p${p}`).hair];
        if (!h.iconic) continue;
        total++;
        inSquad++;
        seen.set(h.name, (seen.get(h.name) ?? 0) + 1);
      }
      if (inSquad >= 3) crowded++;
    }
    expect(total / N).toBeGreaterThan(0.008);
    expect(total / N).toBeLessThan(0.022);
    expect([...seen.keys()].sort()).toEqual([...ICONIC_NAMES].sort());
    expect(crowded / (N / 25)).toBeLessThan(0.02);
  });

  it("the same player id always gets the same look, second colours included", () => {
    for (let i = 0; i < 50; i++) expect(generateAppearance(`same-${i}`)).toEqual(generateAppearance(`same-${i}`));
  });

  it("second colours stay in range and only appear on styles that can show them", () => {
    for (let i = 0; i < 6000; i++) {
      const a = generateAppearance(`tips-${i}`);
      expect(a.hairTip).toBeGreaterThanOrEqual(0);
      expect(a.hairTip).toBeLessThan(HAIR_TIP_COLORS.length);
      expect(a.band).toBeGreaterThanOrEqual(0);
      expect(a.band).toBeLessThan(BAND_COLORS.length);
      if (a.hairTip > 0) expect(supportsHairTips(a.hair)).toBe(true);
      expect(HAIR_STYLES[a.hair].name === "Lion Afro" ? a.hairTip : 0).toBe(0);
    }
  });

  it("Golden hair is only handed out with the Lion Afro, and the Lion Afro is golden all through, not at its ends", () => {
    const golden = HAIR_COLORS.indexOf("#d6a645");
    let lions = 0;
    let goldenLions = 0;
    for (let i = 0; i < 60_000 && lions < 40; i++) {
      const a = generateAppearance(`lion-${i}`);
      if (a.hairColor === golden) expect(HAIR_STYLES[a.hair].name).toBe("Lion Afro");
      if (HAIR_STYLES[a.hair].name === "Lion Afro") {
        lions++;
        if (a.hairColor === golden) goldenLions++;
      }
    }
    expect(goldenLions).toBeGreaterThan(0);
    // The golden hair colour is the hair itself: rendering a golden Lion Afro paints it, and any hair colour works.
    const lion = iconicIndex("Lion Afro");
    for (const hairColor of [0, 2, golden]) {
      const svg = render({ hair: lion, hairColor }, 2);
      expectValid(svg);
      expect(svg).toContain(HAIR_COLORS[hairColor]);
    }
  });

  it("only a Lion Afro iconic roll can turn Golden, only some do, and no other colour or value moves", () => {
    const golden = HAIR_COLORS.indexOf("#d6a645");
    let lions = 0;
    let goldenLions = 0;
    let otherIconic = 0;
    for (let i = 0; i < 40_000 && (lions < 30 || otherIconic < 30); i++) {
      const a = generateAppearance(`rule-${i}`);
      const name = HAIR_STYLES[a.hair].name;
      if (name === "Lion Afro") {
        lions++;
        if (a.hairColor === golden) goldenLions++;
      } else if (HAIR_STYLES[a.hair].iconic) {
        otherIconic++;
        expect(a.hairColor).not.toBe(golden);
      } else {
        expect(a.hairColor).not.toBe(golden);
      }
    }
    expect(goldenLions).toBeGreaterThan(0);
    expect(goldenLions).toBeLessThan(lions);
    expect(otherIconic).toBeGreaterThan(0);
  });

  it("the same player id always gets the same iconic decision and the same colour", () => {
    for (let i = 0; i < 3000; i++) {
      const a = generateAppearance(`again-${i}`);
      const b = generateAppearance(`again-${i}`);
      expect(b.hair).toBe(a.hair);
      expect(b.hairColor).toBe(a.hairColor);
      expect(b).toEqual(a);
    }
  });

  it("styles that take a second colour draw it", () => {
    const tip = HAIR_TIP_COLORS[2];
    for (const name of ["Frosted Faux Hawk", "Textured crop", "Dreadlocks", "Dutch Dreads"]) {
      expect(render({ hair: HAIR_STYLES.findIndex((h) => h.name === name), hairTip: 2 }, 2)).toContain(tip);
    }
  });
});

describe("portrait compatibility: saves", () => {
  it("looks saved before the new options load with no tips and the original headband colour", () => {
    const s = newCareer({ seed: "compat-save" });
    const enc = JSON.parse(JSON.stringify(encodeState(s)));
    for (const p of enc.players as { look: number[] }[]) p.look = p.look.slice(0, 24);
    const back = decodeState(enc);
    for (const p of Object.values(back.players).slice(0, 60)) {
      expect(p.look.hairTip).toBe(0);
      expect(p.look.band).toBe(0);
      expect(sanitizeAppearance(p.look)).toEqual(p.look);
    }
  });

  it("out-of-range second colours are clamped", () => {
    const a = sanitizeAppearance({ ...base, hairTip: 99, band: -4 });
    expect(a.hairTip).toBe(COUNTS.hairTip - 1);
    expect(a.band).toBe(0);
  });
});

describe("portrait compatibility: stress", () => {
  const N = 300;
  const SIZES = [48, 96, 220] as const;
  const AGES = [16, 19, 23, 27, 31, 35, 39];
  const elements = (s: string) => (s.match(/<(path|circle|rect|use|ellipse)\b/g) ?? []).length;

  /** Deterministic players that cover every face shape, hairstyle (iconic included), beard, accessory and age. */
  const player = (i: number): { a: Appearance; age: number } => {
    const g = generateAppearance(`stress-${i}`);
    const a: Appearance = {
      ...g,
      face: i % COUNTS.face,
      hair: (i * 7) % COUNTS.hair,
      facial: (i * 5) % COUNTS.facial,
      accessory: (i * 3) % COUNTS.accessory,
      scar: i % 9 === 0 ? 1 : g.scar,
      hairTip: 0,
      headW: (i * 37) % 101,
      headH: (i * 53) % 101,
      eyeSp: (i * 29) % 101,
      earSc: (i * 41) % 101,
      aging: (i * 17) % 101,
    };
    return { a: { ...a, hairTip: supportsHairTips(a.hair) ? i % COUNTS.hairTip : 0 }, age: AGES[i % AGES.length] };
  };

  it("300 deterministic players draw valid, repeatable portraits at 48, 96 and 220px within the 48px budget", () => {
    const stats = { sum: 0, max: 0, maxHair: "", elSum: 0, elMax: 0, elMaxHair: "" };
    const over: string[] = [];
    for (let i = 0; i < N; i++) {
      const { a, age } = player(i);
      expect(sanitizeAppearance(a)).toEqual(a);
      for (const k of APPEARANCE_KEYS) expect(Number.isFinite(a[k])).toBe(true);
      const m = nextModelFor(a, age, KIT, TRIM);
      const anchors = anchorsFor(m.f, buildHeadNext(m.f));
      const flat = (v: unknown): number[] => (typeof v === "number" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(flat) : []);
      const nums = flat(anchors);
      expect(nums.length).toBeGreaterThan(20);
      for (const n of nums) expect(Number.isFinite(n)).toBe(true);
      for (const px of SIZES) {
        const d = detailFor(px);
        const draw = () => renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m, uid: `s${i}`, d })));
        const svg = draw();
        expectValid(svg);
        expect(svg).toMatch(/<path\b/);
        expect(draw()).toBe(svg);
        if (px !== 48) continue;
        const els = elements(svg);
        const name = HAIR_STYLES[a.hair].name;
        stats.sum += svg.length;
        stats.elSum += els;
        if (svg.length > stats.max) Object.assign(stats, { max: svg.length, maxHair: name });
        if (els > stats.elMax) Object.assign(stats, { elMax: els, elMaxHair: name });
        if (svg.length > 20_000 || els > 110) over.push(`player ${i} (${name}): ${svg.length} chars, ${els} elements`);
      }
    }
    // Diagnostics for the review: printed only when this fails, and kept in the assertion message.
    expect(over, JSON.stringify({ avgChars: Math.round(stats.sum / N), ...stats })).toEqual([]);
    if (process.env.PORTRAIT_STATS) console.log("stress 48px", { avgChars: Math.round(stats.sum / N), maxChars: stats.max, maxCharsHair: stats.maxHair, avgElements: Math.round(stats.elSum / N), maxElements: stats.elMax, maxElementsHair: stats.elMaxHair });
  });
});
