/**
 * Focused review sheet for one new hairstyle, drawn by the real portrait renderer.
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/hairsheet.tsx <out-dir> "<Hairstyle name>" "<Neighbour>,<Neighbour>"
 *   (then: W=1700 CHROMIUM=<chrome> node scripts/portraits/shoot.mjs <out-dir>)
 * Rows: default · pure-black silhouette · 48/96px · four face shapes · compatibility · hair colours · seeded players ·
 * beside the nearest existing styles. Also writes a structural test (no hair, head only) for reference.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PortraitNext, detailFor, viewFor } from "../../src/components/art/portrait-next/art";
import { POC_IDS, hairMeta } from "../../src/components/art/portrait-next/hair";
import { nextModelFor } from "../../src/components/art/portrait-next/model";
import { generateAppearance } from "../../src/engine/appearance/generate";
import { ACCESSORIES, FACIAL_HAIR, HAIR_COLORS, HAIR_STYLES } from "../../src/engine/appearance/options";
import type { Appearance } from "../../src/engine/types";
import { REP } from "./poc";

const out = process.argv[2] ?? "portrait-hair";
const name = process.argv[3] ?? "Golden Buzz";
const neighbours = (process.argv[4] ?? "Short Textured,Frosted Faux Hawk").split(",");
mkdirSync(out, { recursive: true });

const FACES: [string, Partial<Appearance>][] = [
  ["Narrow / long face", { face: 5, headW: 0, headH: 70 }],
  ["Wide / square face", { face: 2, headW: 100, headH: 30 }],
  ["Round face", { face: 1, headW: 70, headH: 0 }],
  ["Angular / diamond", { face: 4, headW: 40, headH: 50 }],
];
const MORE: [string, Partial<Appearance>][] = [
  ["Oval", { face: 0, headW: 50, headH: 50 }],
  ["Broad strong jaw", { face: 6, headW: 100, headH: 40 }],
  ["Long chin", { face: 7, headW: 30, headH: 100 }],
  ["Heart", { face: 8, headW: 50, headH: 40 }],
  ["Narrowest", { face: 0, headW: 0, headH: 100 }],
  ["Widest", { face: 2, headW: 100, headH: 0 }],
];
const idx = (n: string) => {
  // Library names ("Short Textured") differ from option names ("Textured crop"): resolve through the registry.
  const hit = Object.entries(POC_IDS).find(([, id]) => hairMeta(id!)?.name === n);
  const i = hit ? Number(hit[0]) : HAIR_STYLES.findIndex((h) => h.name === n);
  if (i < 0) throw new Error(`unknown hairstyle ${n}`);
  return i;
};
let n = 0;
const draw = (a: Appearance, size = 260, o: { silhouette?: boolean; view?: { x: number; y: number; w: number; h: number }; hairStyle?: string } = {}) => {
  const d = detailFor(size);
  const v = o.view ?? viewFor(d);
  const m = { ...nextModelFor(a, 26, "#b5232f", "#f1ead8", "#2f3e55"), ...(o.hairStyle ? { hairStyle: o.hairStyle } : {}) };
  return renderToStaticMarkup(createElement("svg", { width: size, height: Math.round((size * v.h) / v.w), viewBox: `${v.x} ${v.y} ${v.w} ${v.h}` }, createElement(PortraitNext, { m, uid: `p${n++}`, d, silhouette: o.silhouette })));
};
const css = `body{margin:0;padding:14px;background:#ddd5c4;font:13px sans-serif;color:#222}h3{margin:2px 0 10px}h4{margin:14px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#555}.row{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:10px;align-items:flex-end}.c{display:flex;flex-direction:column;gap:4px}`;
const cell = (l: string, svg: string) => `<div class=c><b>${l}</b>${svg}</div>`;
const named = (list: readonly string[], re: RegExp) => Math.max(0, list.findIndex((x) => re.test(x)));
const H = idx(name);
const base: Appearance = { ...REP, facial: 0, hair: H, hairColor: 2, accessory: 0, scar: 0, mark: 0, freckles: 0, hairTip: 0, band: 0 };
const hair = (h: number, extra: Partial<Appearance> = {}): Appearance => ({ ...base, hair: h, ...extra });
const crown = { x: 40, y: 10, w: 220, h: 200 };
const beard = (re: RegExp) => named(FACIAL_HAIR as unknown as readonly string[], re);
const glasses = Math.max(1, named(ACCESSORIES as readonly string[], /glass/i));
const earring = Math.max(1, named(ACCESSORIES as readonly string[], /stud|ear/i));
const row = (title: string, cells: string[]) => `<h4>${title}</h4><div class=row>${cells.join("")}</div>`;
const sections = [
  row("1 · Default portrait", [cell("Default face", draw(base, 420))]),
  row("2 · Silhouette (pure black hair, plain head)", [cell("Silhouette", draw(base, 420, { silhouette: true })), cell("Head without hair", draw(base, 420, { hairStyle: "none" })), ...neighbours.map((nb) => cell(`${nb} · silhouette`, draw(hair(idx(nb)), 300, { silhouette: true })))]),
  row("3 · Small portraits", [cell("48px", draw(base, 48)), cell("96px", draw(base, 96)), cell("64px", draw(base, 64)), cell("160px", draw(base, 160))]),
  row("4 · Face fitting", FACES.map(([l, f]) => cell(l, draw({ ...base, ...f }, 290)))),
  row("4b · Face fitting, silhouette", FACES.map(([l, f]) => cell(l, draw({ ...base, ...f }, 290, { silhouette: true })))),
  row("4c · Six more head shapes (crown close-up)", MORE.map(([l, f]) => cell(l, draw({ ...base, ...f }, 250, { view: crown })))),
  row("5 · Compatibility", [
    cell("Clean shave", draw(base, 260)),
    cell("Light stubble", draw({ ...base, facial: 1, facialColor: 2 }, 260)),
    cell("Short beard", draw({ ...base, facial: beard(/short|boxed/i), facialColor: 2 }, 260)),
    cell("Full beard", draw({ ...base, facial: beard(/full|boxed/i), facialColor: 2 }, 260)),
    cell("Moustache", draw({ ...base, facial: beard(/^moustache$/i), facialColor: 2 }, 260)),
    cell("Glasses", draw({ ...base, accessory: glasses }, 260)),
    cell("Ear stud", draw({ ...base, accessory: earring }, 260)),
    cell("Headband", draw({ ...base, accessory: 1, band: 3 }, 260)),
    cell("Scar + mark", draw({ ...base, scar: 1, mark: 1 }, 260)),
  ]),
  row("6 · Hair colours (all eleven)", HAIR_COLORS.map((c, k) => cell(`${k} ${c}`, draw({ ...base, hairColor: k, browColor: k }, 170, { view: crown })))),
  row("6b · Pale and dark skin extremes", [0, 4, 9].flatMap((sk) => [1, 6, 10].map((hc) => cell(`skin ${sk} · hair ${hc}`, draw({ ...base, skin: sk, hairColor: hc, browColor: hc }, 190, { view: crown }))))),
  row("7 · Seeded players (same style, different ids)", Array.from({ length: 8 }, (_, k) => {
    const a = { ...generateAppearance(`review-${k}`), hair: H, accessory: 0, scar: 0, mark: 0, band: 0, hairTip: 0 };
    return cell(`review-${k}`, draw(a, 210));
  })),
  row("8 · Beside the nearest existing styles", [name, ...neighbours].map((nm) => cell(nm, draw(hair(idx(nm)), 300)))),
];
writeFileSync(join(out, `${name.toLowerCase().replace(/\s+/g, "-")}.html`), `<!doctype html><meta charset=utf8><style>${css}</style><h3>${name} — review</h3>${sections.join("")}`);
console.log("wrote", out);
