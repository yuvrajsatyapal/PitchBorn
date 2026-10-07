/**
 * Hair review sheet for the improved renderer: the same face with each new hair design, at portrait and game sizes,
 * each with its solid black silhouette.
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/hair.tsx <out-dir>   (then: W=2000 node scripts/portraits/shoot.mjs <out-dir>)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { B, REP, REP_O } from "./poc";
import type { Appearance } from "../../src/engine/types";

const out = process.argv[2] ?? "portrait-hair";
mkdirSync(out, { recursive: true });

const STYLES: [string, string][] = [
  ["textured-crop", "1. Short Textured"],
  ["medium-afro", "2. Medium Afro"],
  ["medium-dreads", "3. Medium Dreads"],
  ["long-flow", "4. Long Flow"],
  ["classic-curtains", "5. Classic Curtains"],
  ["curly-fade", "6. Curly Fade"],
  ["brazilian-crescent", "7. Brazilian Crescent"],
  ["classic-mullet", "8. Classic Mullet"],
];
const face: Appearance = { ...REP, facial: 1 };
const col = ([id, label]: [string, string]) => {
  const o = { ...REP_O, hairStyle: id };
  return `<div class=c><b>${label}</b>${B(face, 220, o)}${B(face, 220, { ...o, silhouette: true })}<div class=s>${B(face, 96, o)}${B(face, 48, o)}${B(face, 48, { ...o, silhouette: true })}</div></div>`;
};
const css = `body{margin:0;padding:14px;background:#ddd5c4;font:13px sans-serif;color:#222}h3{margin:2px 0 10px}.g{display:grid;grid-template-columns:repeat(8,228px);gap:12px}.c{display:flex;flex-direction:column;gap:6px}.s{display:flex;gap:6px;align-items:flex-end}`;
writeFileSync(
  join(out, "hair.html"),
  `<!doctype html><meta charset=utf8><style>${css}</style><h3>Hair pass: same face, eight styles — portrait (220px), black silhouette, then 96px, 48px and 48px silhouette</h3><div class=g>${STYLES.map(col).join("")}</div>`,
);
writeFileSync(
  join(out, "zoom.html"),
  `<!doctype html><meta charset=utf8><style>${css}.z{display:grid;grid-template-columns:repeat(4,430px);gap:12px}</style><div class=z>${STYLES.map(([id, label]) => `<div><b>${label}</b><br>${B(face, 420, { ...REP_O, hairStyle: id })}</div>`).join("")}</div>`,
);
// Final review layout: row 1 portraits, row 2 silhouettes, row 3 at 48px.
const row = (cells: string[]) => `<div class=row>${cells.join("")}</div>`;
writeFileSync(
  join(out, "review.html"),
  `<!doctype html><meta charset=utf8><style>${css}.row{display:grid;grid-template-columns:repeat(8,228px);gap:12px;margin-bottom:14px;align-items:end}.lab{font-weight:600}</style>` +
    `<h3>Hair pass 2 — same face: portrait size, black silhouette, 48px</h3>` +
    row(STYLES.map(([, label]) => `<div class=lab>${label}</div>`)) +
    row(STYLES.map(([id]) => B(face, 220, { ...REP_O, hairStyle: id }))) +
    row(STYLES.map(([id]) => B(face, 220, { ...REP_O, hairStyle: id, silhouette: true }))) +
    row(STYLES.map(([id]) => B(face, 48, { ...REP_O, hairStyle: id }))),
);
// Same hairstyle on different heads: the hair must follow skull width, forehead, temples and head height.
const FACES: [string, Appearance][] = [
  ["Narrow, head width 0", { ...face, face: 5, headW: 0, headH: 50 }],
  ["Broad, head width 100", { ...face, face: 6, headW: 100, headH: 40 }],
  ["Long, head height 100", { ...face, face: 7, headW: 30, headH: 100 }],
  ["Round, short head", { ...face, face: 1, headW: 70, headH: 0, aging: 15 }],
];
const COMPAT: [string, string][] = [STYLES[0], STYLES[1], STYLES[4], STYLES[2]];
writeFileSync(
  join(out, "faces.html"),
  `<!doctype html><meta charset=utf8><style>${css}.row{display:grid;grid-template-columns:150px repeat(4,228px);gap:12px;margin-bottom:12px;align-items:center}.lab{font-weight:600}</style>` +
    `<h3>Same hairstyle, different heads</h3>` +
    row([`<div></div>`, ...FACES.map(([l]) => `<div class=lab>${l}</div>`)]) +
    COMPAT.map(([id, label]) => row([`<div class=lab>${label}</div>`, ...FACES.map(([, a]) => B(a, 220, { ...REP_O, hairStyle: id }))])).join(""),
);
// One close-up per style when ONE=<id> is set (inspection while iterating).
if (process.env.ONE) writeFileSync(join(out, `one-${process.env.ONE}.html`), `<!doctype html><body style="margin:0;background:#ddd">${B(face, 760, { ...REP_O, hairStyle: process.env.ONE })}</body>`);
console.log("wrote", out);
