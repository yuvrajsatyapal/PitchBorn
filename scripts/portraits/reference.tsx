/**
 * Art-direction sheets for the portrait renderer, built from explicit face specs (not the generator):
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/reference.tsx <out-dir>
 * reference: one portrait, plain background, no texture (and the same with the retro treatment)
 * six: six different men with identical hair, shirt and background
 * bald: six bald, clean-shaven men with the same skin tone
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PortraitArt, VIEW, type PortraitModel } from "../../src/components/art/portrait/art";
import { REFERENCE_FACE } from "../../src/components/art/portrait/anatomy";
import { SIX_FACES } from "./faces";
import { FACIAL_HAIR, HAIR_STYLES } from "../../src/engine/appearance/options";

const out = process.argv[2] ?? "portrait-sheets";
mkdirSync(out, { recursive: true });

const base: PortraitModel = {
  f: REFERENCE_FACE, skin: "#d9a07a", iris: "#4a2e1a", hair: 4, hairColor: "#2a1c14", browColor: "#24170f", facial: 0, facialColor: "#2a1c14",
  recede: 0, facialGrey: 0, lines: 0, youth: 0, freckles: false, scar: 0, mark: 0, accessory: 0, band: "#f1ead8", hairTip: null, kit: "#b5232f", trim: "#f1ead8", background: "#2f3e55",
};

let n = 0;
const svg = (m: PortraitModel, size: number, textured = false) => {
  const art = createElement(PortraitArt, { m, uid: `p${n++}`, textured });
  return renderToStaticMarkup(createElement("svg", { width: size, height: Math.round((size * VIEW.h) / VIEW.w), viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}` }, art));
};
const page = (title: string, cells: string[]) => `<!doctype html><meta charset=utf8><style>body{margin:0;padding:12px;background:#ddd5c4;font:13px sans-serif}.g{display:flex;flex-wrap:wrap;gap:10px}</style><b>${title}</b><div class=g>${cells.join("")}</div>`;


writeFileSync(join(out, "reference.html"), page("reference (no texture | retro)", [svg(base, 420), svg(base, 420, true)]));
writeFileSync(join(out, "zoom.html"), page("zoom", [svg(base, 900)]));
writeFileSync(join(out, "six.html"), page("six faces, same hair", SIX_FACES.map((f) => svg({ ...base, f }, 240))));
writeFileSync(join(out, "bald.html"), page("bald test", SIX_FACES.map((f) => svg({ ...base, f, hair: 0 }, 240))));
writeFileSync(join(out, "small.html"), page("48 / 64 / 96 / 256", [48, 64, 96, 256].map((s) => svg(base, s))));
writeFileSync(join(out, "hairstyles.html"), page("every hairstyle", HAIR_STYLES.map((h, i) => `<div>${svg({ ...base, hair: i, hairColor: ["#2a1c14", "#16110d", "#5b3a22", "#a37a45", "#7a2f1a"][i % 5] }, 170)}<br>${i} ${h.name}</div>`)));
writeFileSync(join(out, "facial.html"), page("every facial hair style", FACIAL_HAIR.map((name, i) => `<div>${svg({ ...base, facial: i, f: SIX_FACES[i % 6] }, 170)}<br>${i} ${name}</div>`)));
console.log("wrote", out);
