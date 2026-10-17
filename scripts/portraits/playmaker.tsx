/**
 * Review sheet for Playmaker Waves in the improved renderer.
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/playmaker.tsx <out-dir>   (then: W=1700 CHROMIUM=<chrome> node scripts/portraits/shoot.mjs <out-dir>)
 * Rows: default face · pure-black silhouette · 48px · four skulls · beards and glasses · side-by-side with its neighbours.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PortraitNext, detailFor, viewFor } from "../../src/components/art/portrait-next/art";
import { nextModelFor } from "../../src/components/art/portrait-next/model";
import { ACCESSORIES, FACIAL_HAIR } from "../../src/engine/appearance/options";
import type { Appearance } from "../../src/engine/types";
import { REP } from "./poc";

const FACES: [string, Partial<Appearance>][] = [
  ["Narrow / long face", { face: 5, headW: 0, headH: 70 }],
  ["Wide / square face", { face: 2, headW: 100, headH: 30 }],
  ["Round face", { face: 1, headW: 70, headH: 0 }],
  ["Angular / diamond", { face: 4, headW: 40, headH: 50 }],
];
const out = process.argv[2] ?? "portrait-playmaker";
mkdirSync(out, { recursive: true });
const PLAYMAKER = 45;
const named = (list: readonly string[], re: RegExp) => list.findIndex((n) => re.test(n));
const draw = (a: Appearance, size = 260, silhouette = false, view?: { x: number; y: number; w: number; h: number }) => {
  const d = detailFor(size);
  const v = view ?? viewFor(d);
  const m = nextModelFor(a, 26, "#b5232f", "#f1ead8", "#2f3e55");
  return renderToStaticMarkup(createElement("svg", { width: size, height: Math.round((size * v.h) / v.w), viewBox: `${v.x} ${v.y} ${v.w} ${v.h}` }, createElement(PortraitNext, { m, uid: `p${n++}`, d, silhouette })));
};
let n = 0;
const css = `body{margin:0;padding:14px;background:#ddd5c4;font:13px sans-serif;color:#222}h3{margin:2px 0 10px}.row{display:flex;gap:12px;margin-bottom:14px;align-items:flex-end}.c{display:flex;flex-direction:column;gap:4px}`;
const cell = (l: string, svg: string) => `<div class=c><b>${l}</b>${svg}</div>`;
const base: Appearance = { ...REP, facial: 0, hair: PLAYMAKER, hairColor: 2, accessory: 0, scar: 0, mark: 0, freckles: 0, hairTip: 0, band: 0 };
const hair = (h: number): Appearance => ({ ...base, hair: h });
const glasses = Math.max(1, named(ACCESSORIES as readonly string[], /glass/i));
const beard = (re: RegExp) => Math.max(0, named(FACIAL_HAIR as unknown as readonly string[], re));
const pick = (names: string[]) => FACES.filter((f) => names.some((x) => f[0].startsWith(x)));
const rows = [
  `<div class=row>${cell("Default face", draw(base, 420))}${cell("Black silhouette", draw(base, 420, true))}<div class=c><b>48px</b>${draw(base, 48)}<b>96px</b>${draw(base, 96)}</div>${cell("Light brown", draw({ ...base, hairColor: 4 }, 260))}${cell("Blond", draw({ ...base, hairColor: 6 }, 260))}</div>`,
  `<div class=row>${pick(["Narrow", "Wide", "Round", "Angular"]).map(([l, f]) => cell(l, draw({ ...base, ...f }, 290))).join("")}</div>`,
  `<div class=row>${pick(["Narrow", "Wide", "Round", "Angular"]).map(([l, f]) => cell(`${l} · silhouette`, draw({ ...base, ...f }, 290, true))).join("")}</div>`,
  `<div class=row>${[["Clean shave", 0], ["Stubble", beard(/stubble/i)], ["Short beard", beard(/short/i)], ["Full beard", beard(/full|boxed/i)], ["Moustache", beard(/mous/i)]].map(([l, fa]) => cell(String(l), draw({ ...base, facial: Number(fa), facialColor: 2 }, 260))).join("")}${cell("Glasses", draw({ ...base, accessory: glasses }, 260))}</div>`,
  `<div class=row>${[["Short Textured", 7], ["Classic Curtains", 24], ["Playmaker Waves", PLAYMAKER], ["Long Flow", 23], ["Classic Mullet", 29]].map(([l, h]) => cell(String(l), draw(hair(Number(h)), 300))).join("")}</div>` +
    `<div class=row>${[["Short Textured", 7], ["Classic Curtains", 24], ["Playmaker Waves", PLAYMAKER], ["Long Flow", 23], ["Classic Mullet", 29]].map(([l, h]) => cell(`${l} · silhouette`, draw(hair(Number(h)), 300, true))).join("")}</div>`,
];
writeFileSync(join(out, "playmaker.html"), `<!doctype html><meta charset=utf8><style>${css}</style><h3>Playmaker Waves — review</h3>${rows.join("")}`);
console.log("wrote", out);
