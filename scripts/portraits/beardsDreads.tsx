/**
 * Review sheets for Dutch Dreads, Boxed Beard, Long Beard and Chin Beard in the improved renderer.
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/beardsDreads.tsx <out-dir>   (then: W=1800 node scripts/portraits/shoot.mjs <out-dir>)
 * A: Dutch Dreads · B: the three beards · C: beard colour on skin · D: beards on six faces · E: 60 stress combinations.
 * Every portrait comes from stored appearance values; the only overrides are the facial-hair colour for the white beard.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PortraitNext, detailFor, viewFor } from "../../src/components/art/portrait-next/art";
import { COLLARS } from "../../src/components/art/portrait-next/kit";
import { nextModelFor } from "../../src/components/art/portrait-next/model";
import { generateAppearance } from "../../src/engine/appearance/generate";
import { COUNTS, HAIR_COLORS, SKIN_NAMES } from "../../src/engine/appearance/options";
import type { Appearance } from "../../src/engine/types";
import { REP } from "./poc";

const out = process.argv[2] ?? "portrait-beards-dreads";
mkdirSync(out, { recursive: true });

export const DUTCH = 44;
export const BOXED = 9;
export const LONG = 11;
export const CHIN = 12;
const BEARDS: [string, number][] = [["Boxed Beard", BOXED], ["Long Beard", LONG], ["Chin Beard", CHIN]];
const KIT = "#b5232f";
const TRIM = "#f1ead8";
const BG = "#2f3e55";

let n = 0;
interface Opts {
  size?: number;
  age?: number;
  silhouette?: boolean;
  view?: { x: number; y: number; w: number; h: number };
  facialColor?: string;
  kit?: string;
  bg?: string;
  collar?: (typeof COLLARS)[number];
}
const draw = (a: Appearance, o: Opts = {}) => {
  const size = o.size ?? 240;
  const d = detailFor(size);
  const v = o.view ?? viewFor(d);
  const m = nextModelFor(a, o.age ?? 26, o.kit ?? KIT, TRIM, o.bg ?? BG);
  const model = { ...m, ...(o.collar ? { collar: o.collar } : {}), ...(o.facialColor ? { facialColor: o.facialColor } : {}) };
  return renderToStaticMarkup(
    createElement("svg", { width: size, height: Math.round((size * v.h) / v.w), viewBox: `${v.x} ${v.y} ${v.w} ${v.h}` }, createElement(PortraitNext, { m: model, uid: `s${n++}`, d, silhouette: o.silhouette })),
  );
};
const css = `body{margin:0;padding:14px;background:#ddd5c4;font:13px sans-serif;color:#222}h3{margin:2px 0 10px}.row{display:flex;gap:12px;margin-bottom:14px;align-items:flex-end}.c{display:flex;flex-direction:column;gap:4px}.c b{font-weight:600}.c small{color:#555}.g{display:grid;gap:10px}`;
const cell = (label: string, svg: string, sub = "") => `<div class=c><b>${label}</b>${svg}${sub ? `<small>${sub}</small>` : ""}</div>`;
const sheet = (name: string, title: string, body: string) => writeFileSync(join(out, `${name}.html`), `<!doctype html><meta charset=utf8><style>${css}</style><h3>${title}</h3>${body}`);

const base: Appearance = { ...REP, facial: 0, hair: 0, accessory: 0, scar: 0, mark: 0, freckles: 0, hairTip: 0, band: 0 };

/** Faces with very different skulls, jaws and chins (shape index, sliders). */
export const FACES: [string, Partial<Appearance>][] = [
  ["Narrow / long face", { face: 5, headW: 0, headH: 70 }],
  ["Wide / square face", { face: 2, headW: 100, headH: 30 }],
  ["Round face", { face: 1, headW: 70, headH: 0 }],
  ["Oval face", { face: 0, headW: 50, headH: 50 }],
  ["Angular / diamond · small chin", { face: 4, headW: 40, headH: 50 }],
  ["Broad strong jaw", { face: 6, headW: 100, headH: 40 }],
  ["Long chin", { face: 7, headW: 30, headH: 100 }],
  ["Heart · small chin", { face: 8, headW: 50, headH: 40 }],
];
const dutch = (a: Partial<Appearance> = {}): Appearance => ({ ...base, hair: DUTCH, hairColor: 2, ...a });

// ------------------------------------------------------------------ A: Dutch Dreads
{
  const d0 = dutch();
  const crown = { x: 50, y: 14, w: 200, h: 150 };
  const faces = FACES.filter((f) => ["Narrow / long face", "Wide / square face", "Round face", "Angular / diamond · small chin"].includes(f[0]));
  sheet(
    "A-dutch-dreads",
    "A · Dutch Dreads — default face, pure-black silhouette, crown/root close-up, 48px and 96px, then four different heads",
    `<div class=row>${cell("Default face", draw(d0, { size: 400 }))}${cell("Black silhouette", draw(d0, { size: 400, silhouette: true }))}${cell("Crown and roots (close-up)", draw(d0, { size: 640, view: crown }))}<div class=c><b>48px</b>${draw(d0, { size: 48 })}<b>96px</b>${draw(d0, { size: 96 })}</div></div>` +
      `<div class=row>${faces.map(([l, f]) => cell(l, draw(dutch(f), { size: 300 }))).join("")}</div>` +
      `<div class=row>${faces.map(([l, f]) => cell(`${l} · silhouette`, draw(dutch(f), { size: 300, silhouette: true }))).join("")}</div>` +
      `<div class=row>${[HAIR_COLORS[0], HAIR_COLORS[6], HAIR_COLORS[7], HAIR_COLORS[9]].map((_, i) => cell(`Hair colour ${[0, 6, 7, 9][i]}`, draw(dutch({ hairColor: [0, 6, 7, 9][i], skin: [8, 2, 5, 1][i], aging: 40 }), { size: 300 }))).join("")}</div>`,
  );
}

// ------------------------------------------------------------------ B: three beards
{
  const lowerFace = { x: 70, y: 150, w: 160, h: 170 };
  const row = (a: Partial<Appearance>, size: number, view?: Opts["view"]) => `<div class=row>${BEARDS.map(([l, s]) => cell(l, draw({ ...base, hair: 7, hairColor: 3, facialColor: 3, ...a, facial: s }, { size, view }))).join("")}</div>`;
  sheet("B-beard-styles", "B · Boxed, Long and Chin beard on the same face — silhouettes must differ", row({}, 420) + row({}, 560, lowerFace) + row({ skin: 5, face: 2, headW: 80 }, 300) + `<div class=row>${BEARDS.map(([l, s]) => cell(`${l} 48px`, draw({ ...base, hair: 7, hairColor: 3, facialColor: 3, facial: s }, { size: 48 }))).join("")}</div>`);
}

// ------------------------------------------------------------------ C: colour compatibility
export const COLOURS: { label: string; skin: number; colour: number | string }[] = [
  { label: "Light skin + black beard", skin: 1, colour: 0 },
  { label: "Light skin + blonde beard", skin: 1, colour: 6 },
  { label: "Medium skin + brown beard", skin: 4, colour: 4 },
  { label: "Dark skin + black beard", skin: 8, colour: 0 },
  { label: "Dark skin + blonde beard", skin: 8, colour: 6 },
  { label: "Medium skin + ginger beard", skin: 4, colour: 7 },
  { label: "Light skin + grey beard", skin: 0, colour: 9 },
  { label: "Dark skin + white beard", skin: 9, colour: "#e9e7e0" },
  { label: "Deep brown skin + dark brown beard", skin: 7, colour: 2 },
  { label: "Bronze skin + brown beard", skin: 6, colour: 4 },
];
{
  const rows = COLOURS.map((c) => {
    const idx = typeof c.colour === "number" ? c.colour : 9;
    const col = typeof c.colour === "string" ? c.colour : undefined;
    return `<div class=row><div class=c style="width:150px"><b>${c.label}</b><small>${SKIN_NAMES[c.skin]} · ${col ?? HAIR_COLORS[idx]}</small></div>${BEARDS.map(([, s]) => draw({ ...base, hair: 7, skin: c.skin, hairColor: idx, facialColor: idx, facial: s }, { size: 240, facialColor: col })).join("")}<div class=c>${BEARDS.map(([, s]) => draw({ ...base, hair: 7, skin: c.skin, hairColor: idx, facialColor: idx, facial: s }, { size: 48, facialColor: col })).join("")}</div></div>`;
  });
  sheet("C-beard-colour", "C · Beard colour on skin: Boxed, Long and Chin (240px) and each at 48px", rows.join(""));
}

// ------------------------------------------------------------------ D: face compatibility
{
  const rows = FACES.map(([l, f]) => `<div class=row><div class=c style="width:130px"><b>${l}</b></div>${BEARDS.map(([, s]) => draw({ ...base, hair: 7, hairColor: 3, facialColor: 3, skin: 3, ...f, facial: s }, { size: 270 })).join("")}</div>`);
  sheet("D-face-compat", "D · All three beard styles across eight different faces and chin widths", rows.join(""));
}

// ------------------------------------------------------------------ E: stress test
{
  const cells: string[] = [];
  for (let i = 0; i < 60; i++) {
    const g = generateAppearance(`beard-dreads-${i}`);
    const style = i % 4;
    const a: Appearance = {
      ...g,
      skin: (i * 7) % COUNTS.skin,
      face: (i * 5) % COUNTS.face,
      hairColor: (i * 3) % 9,
      facialColor: (i * 5 + 2) % 9,
      accessory: i % COUNTS.accessory,
      headW: (i * 37) % 101,
      headH: (i * 53) % 101,
      hair: style === 0 ? DUTCH : g.hair,
      facial: style === 0 ? [0, BOXED, LONG, CHIN][(i >> 2) % 4] : [BOXED, LONG, CHIN][style - 1],
      hairTip: style === 0 && i % 3 === 0 ? 2 : 0,
    };
    cells.push(cell(`#${i}`, draw(a, { size: 170, age: 18 + (i % 20), collar: COLLARS[i % COLLARS.length] }), `${["Dutch", "Boxed", "Long", "Chin"][style]} · face ${a.face} · skin ${a.skin}`));
  }
  sheet("E-stress", "E · 60 deterministic combinations (no selection): faces, skin, hair colour, accessories, collars, ages", `<div class=g style="grid-template-columns:repeat(8,170px)">${cells.join("")}</div>`);
}
console.log("wrote", out);

// ------------------------------------------------------------------ F: goatee styles
{
  const GOATEES: [string, number][] = [["Goatee", 5], ["Moustache + goatee", 6]];
  const rows = FACES.slice(0, 6).map(([l, f]) => `<div class=row><div class=c style="width:130px"><b>${l}</b></div>${GOATEES.map(([, s]) => draw({ ...base, hair: 7, hairColor: 3, facialColor: 3, skin: 3, ...f, facial: s }, { size: 270 })).join("")}${GOATEES.map(([, s]) => draw({ ...base, hair: 7, hairColor: 3, facialColor: 3, skin: 3, ...f, facial: s }, { size: 48 })).join("")}</div>`);
  sheet("F-goatees", "F · Goatee and Moustache + goatee on six faces (and 48px)", rows.join(""));
}
