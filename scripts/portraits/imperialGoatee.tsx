/**
 * Review sheet for the Imperial Goatee, drawn by the real portrait renderer.
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/imperialGoatee.tsx <out-dir> before   (snapshot of the current art, before.json)
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/imperialGoatee.tsx <out-dir>          (sheet; rows 1 and 3 compare with before.json)
 *   CHROMIUM=<chrome> W=1700 node scripts/portraits/shoot.mjs <out-dir>
 * The silhouette calls the beard drawing directly, in black, on a plain head.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { anchorsFor } from "../../src/components/art/portrait-next/anchors";
import { PortraitNext, detailFor, viewFor } from "../../src/components/art/portrait-next/art";
import { BeardNext } from "../../src/components/art/portrait-next/facialHair";
import { buildHeadNext } from "../../src/components/art/portrait-next/head";
import { withDetail } from "../../src/components/art/portrait-next/ink";
import { nextModelFor } from "../../src/components/art/portrait-next/model";
import { skinTones } from "../../src/components/art/portrait-next/palette";
import { generateAppearance } from "../../src/engine/appearance/generate";
import { FACIAL_HAIR } from "../../src/engine/appearance/options";
import type { Appearance } from "../../src/engine/types";
import { REP } from "./poc";

const out = process.argv[2] ?? "imperial-goatee";
const beforeMode = process.argv[3] === "before";
mkdirSync(out, { recursive: true });

const KIT = "#b5232f";
const TRIM = "#f1ead8";
const BG = "#2f3e55";
const IMPERIAL = FACIAL_HAIR.indexOf("Imperial Goatee");
const style = (name: string) => FACIAL_HAIR.indexOf(name as (typeof FACIAL_HAIR)[number]);
const base: Appearance = { ...REP, facial: IMPERIAL, hair: 7, hairColor: 3, facialColor: 3, accessory: 0, scar: 0, mark: 0, freckles: 0, hairTip: 0, band: 0 };

type View = { x: number; y: number; w: number; h: number };
let n = 0;
const model = (a: Appearance) => nextModelFor(a, 26, KIT, TRIM, BG);
const draw = (a: Appearance, size = 240, view?: View) => {
  const d = detailFor(size);
  const v = view ?? viewFor(d);
  return renderToStaticMarkup(createElement("svg", { width: size, height: Math.round((size * v.h) / v.w), viewBox: `${v.x} ${v.y} ${v.w} ${v.h}` }, createElement(PortraitNext, { m: model(a), uid: `s${n++}`, d })));
};
/** Pure black facial hair on a plain head, white background: no texture, colour or features. */
const silhouette = (a: Appearance, size: number, view?: View) => {
  const d = detailFor(size);
  const v = view ?? viewFor(d);
  const m = model(a);
  const head = buildHeadNext(m.f);
  const anchors = anchorsFor(m.f, head);
  const uid = `i${n++}`;
  const body = withDetail(d, () => BeardNext({ f: m.f, head, a: anchors, t: skinTones("#ffffff"), style: a.facial, color: "#000000", youth: 0, d, uid, pSeed: m.seed }));
  return renderToStaticMarkup(
    createElement(
      "svg",
      { width: size, height: Math.round((size * v.h) / v.w), viewBox: `${v.x} ${v.y} ${v.w} ${v.h}` },
      createElement("defs", null, createElement("filter", { id: `${uid}k` }, createElement("feColorMatrix", { type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" }))),
      createElement("rect", { x: v.x, y: v.y, width: v.w, height: v.h, fill: "#fff" }),
      createElement("path", { d: head.path, fill: "#e6e6e6", stroke: "#bbb", strokeWidth: 1 }),
      createElement("g", { filter: `url(#${uid}k)` }, body),
    ),
  );
};

const FACES: [string, Partial<Appearance>][] = [
  ["Narrow / long", { face: 5, headW: 0, headH: 70 }],
  ["Wide / square", { face: 2, headW: 100, headH: 30 }],
  ["Round", { face: 1, headW: 70, headH: 0 }],
  ["Angular / diamond", { face: 4, headW: 40, headH: 50 }],
];
const MORE: [string, Partial<Appearance>][] = [
  ["Oval", { face: 0, headW: 50, headH: 50 }],
  ["Broad strong jaw", { face: 9, headW: 80, headH: 40 }],
  ["Long chin", { face: 7, headW: 30, headH: 100 }],
  ["Heart", { face: 8, headW: 50, headH: 40 }],
  ["Narrowest", { face: 5, headW: 0, headH: 50 }],
  ["Widest", { face: 6, headW: 100, headH: 40 }],
];
const lower: View = { x: 70, y: 170, w: 160, h: 140 };
const mouthView = (a: Appearance): View => {
  const f = model(a).f;
  return { x: 150 - 50, y: f.mouthY - 26, w: 100, h: 80 };
};
const chinView = (a: Appearance): View => {
  const f = model(a).f;
  return { x: 150 - 60, y: f.chinY - 52, w: 120, h: 96 };
};
const A = (extra: Partial<Appearance> = {}): Appearance => ({ ...base, ...extra });

if (beforeMode) {
  writeFileSync(join(out, "before.json"), JSON.stringify({
    portrait: draw(A(), 400),
    lower: draw(A(), 480, lower),
    silhouette: silhouette(A(), 340),
    silhouetteNarrow: silhouette(A(FACES[0][1]), 260),
    silhouetteWide: silhouette(A(FACES[1][1]), 260),
  }));
  console.log("wrote before.json");
  process.exit(0);
}

const before = existsSync(join(out, "before.json")) ? (JSON.parse(readFileSync(join(out, "before.json"), "utf8")) as Record<string, string>) : null;
const css = `body{margin:0;padding:14px;background:#ddd5c4;font:13px sans-serif;color:#222}h3{margin:2px 0 10px}h4{margin:14px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#555}.row{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:10px;align-items:flex-end}.c{display:flex;flex-direction:column;gap:4px}`;
const cell = (l: string, svg: string) => `<div class=c><b>${l}</b>${svg}</div>`;
const row = (title: string, cells: string[]) => `<h4>${title}</h4><div class=row>${cells.join("")}</div>`;
const COLOURS: [string, number][] = [["Natural black", 1], ["Dark brown", 2], ["Light brown", 4], ["Blonde", 6], ["Ginger", 7], ["Grey", 9]];

const sections = [
  row("1 · Current (before) versus improved: default portrait and lower face", [
    ...(before ? [cell("Before", before.portrait), cell("Before · lower face", before.lower)] : []),
    cell("Improved", draw(A(), 400)),
    cell("Improved · lower face", draw(A(), 480, lower)),
  ]),
  row("2 · Close-ups: moustache, mouth connectors, soul patch, chin beard", [
    cell("Mouth and connectors", draw(A(), 420, mouthView(A()))),
    cell("Soul patch and chin", draw(A(), 420, chinView(A()))),
    cell("Narrow face", draw(A(FACES[0][1]), 420, chinView(A(FACES[0][1])))),
    cell("Wide face", draw(A(FACES[1][1]), 420, chinView(A(FACES[1][1])))),
  ]),
  row("3 · Pure-black silhouette (facial hair only, plain head, white background)", [
    ...(before ? [cell("Before", before.silhouette), cell("Before · narrow", before.silhouetteNarrow), cell("Before · wide", before.silhouetteWide)] : []),
    cell("Improved", silhouette(A(), 340)),
    cell("Improved · narrow", silhouette(A(FACES[0][1]), 260)),
    cell("Improved · wide", silhouette(A(FACES[1][1]), 260)),
  ]),
  row("4 · Sizes", [cell("48px", draw(A(), 48)), cell("48px ×4 (same art)", `<div style="zoom:4">${draw(A(), 48)}</div>`), cell("96px", draw(A(), 96)), cell("96px ×2", `<div style="zoom:2">${draw(A(), 96)}</div>`), cell("Normal 240px", draw(A(), 240)), cell("Large 420px", draw(A(), 420))]),
  row("5 · Narrow, wide, round, angular", FACES.map(([l, f]) => cell(l, draw(A(f), 290)))),
  row("5b · Same faces, lower face", FACES.map(([l, f]) => cell(l, draw(A(f), 290, lower)))),
  row("6 · Oval, broad jaw, long chin, heart, narrowest, widest", MORE.map(([l, f]) => cell(l, draw(A(f), 220)))),
  row("6b · Same faces, lower face", MORE.map(([l, f]) => cell(l, draw(A(f), 220, lower)))),
  row("7 · Beard colour (light skin, then dark skin)", [
    ...COLOURS.map(([l, c]) => cell(l, draw(A({ facialColor: c, hairColor: c, skin: 2 }), 200))),
    ...COLOURS.slice(0, 5).map(([l, c]) => cell(`${l} · dark skin`, draw(A({ facialColor: c, hairColor: c, skin: 8 }), 200))),
  ]),
  row("8 · Beside the existing Moustache, Short beard and Full beard", [cell("Imperial Goatee (new)", draw(A(), 260)), ...["Moustache", "Short beard", "Full beard"].map((c) => cell(c, draw(A({ facial: style(c) }), 260)))]),
  row("9 · Four seeded players", Array.from({ length: 4 }, (_, i) => cell(`player ${i + 1}`, draw({ ...generateAppearance(`imperial-${i}`), facial: IMPERIAL, accessory: 0 }, 240)))),
];
writeFileSync(join(out, "imperial-goatee.html"), `<!doctype html><meta charset=utf8><style>${css}</style><h3>Imperial Goatee · review sheet (real portrait renderer)</h3>${sections.join("")}`);
console.log("wrote", out);
