/**
 * Portrait QA sheets. Renders deterministic players to a static HTML page, then (optionally) screenshots it.
 *   npx tsx scripts/portraits/sheet.tsx <out-dir>
 * Sheets: contact (36 random players), bald (12 bald + clean-shaven), silhouette, sizes (48/64/96/256).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PlayerPortrait } from "../../src/components/art/PlayerPortrait";
import { generateAppearance } from "../../src/engine/appearance/generate";

const out = process.argv[2] ?? "portrait-sheets";
mkdirSync(out, { recursive: true });
const KITS = ["#c8102e", "#1d4ea8", "#2e8b57", "#e2b007", "#5b2a86", "#111111"];

const svg = (i: number, size: number, mod?: (a: ReturnType<typeof generateAppearance>) => void, mode = "") => {
  const a = generateAppearance(`sheet-${i}`);
  mod?.(a);
  return renderToStaticMarkup(createElement(PlayerPortrait, { appearance: a, age: 18 + ((i * 7) % 20), size, kit: KITS[i % KITS.length], background: mode === "sil" ? "#fff" : undefined }));
};
const page = (title: string, cells: string[], cols: number, extraCss = "") =>
  `<!doctype html><meta charset=utf8><style>:root{--sun-2:#e9dfc8}body{margin:0;padding:14px;background:#d8cfba;font:12px sans-serif}.g{display:grid;grid-template-columns:repeat(${cols},auto);gap:10px;justify-content:start}${extraCss}</style><h3>${title}</h3><div class=g>${cells.join("")}</div>`;

writeFileSync(join(out, "contact.html"), page("contact", Array.from({ length: 36 }, (_, i) => svg(i, 150)), 9));
writeFileSync(join(out, "bald.html"), page("bald", Array.from({ length: 12 }, (_, i) => svg(i + 100, 200, (a) => { a.hair = 0; a.facial = 0; a.hairColor = 0; a.accessory = 0; a.scar = 0; })), 6));
// Silhouettes: every colour becomes black on a white card, so only the head, hair and shoulder outline remain.
const sil = (i: number) => svg(i + 200, 150, undefined, "sil").replace(/fill="url\([^)]*\)"/g, 'fill="none"').replace(/(fill|stroke)="#(?!fff")[0-9a-fA-F]{6}"/g, '$1="#000"').replace(/<rect[^>]*filter="url\(#pbp-grain\)"[^>]*>/g, "");
writeFileSync(join(out, "silhouette.html"), page("silhouette", Array.from({ length: 12 }, (_, i) => sil(i).replace("<svg", '<svg style="background:#fff;border-radius:14px"')), 6));
writeFileSync(join(out, "sizes.html"), page("sizes", [48, 64, 96, 256].flatMap((s) => [3, 9, 15].map((i) => svg(i, s))), 12));
const zoom = (process.env.ZOOM ?? "3,9,14").split(",").map(Number);
writeFileSync(join(out, "zoom.html"), page("zoom", zoom.map((i) => svg(i, 320)), 4));
console.log("wrote", out);
