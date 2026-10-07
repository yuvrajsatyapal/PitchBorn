/**
 * Hair review sheet for the improved renderer: the same face with each new hair design, at portrait and game sizes,
 * each with its solid black silhouette.
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/hair.tsx <out-dir>   (then: W=2000 node scripts/portraits/shoot.mjs <out-dir>)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { B, REP, REP_O } from "./poc";

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
const face = { ...REP, facial: 1 };
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
console.log("wrote", out);
