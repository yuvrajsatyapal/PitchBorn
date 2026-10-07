/**
 * Level-of-detail review: Long Headband Curls at 48 / 96 / normal / large, and the styles that were thinned for
 * 48px, each at actual size and enlarged.
 *   TAG=before npx tsx --tsconfig tsconfig.json scripts/portraits/lod.tsx <out-dir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { B, REP, REP_O } from "./poc";
import { HAIR_STYLES } from "../../src/engine/appearance/options";

const out = process.argv[2] ?? "portrait-lod";
mkdirSync(out, { recursive: true });
const tag = process.env.TAG ?? "";
const ix = (name: string) => HAIR_STYLES.findIndex((h) => h.name === name);
const look = (name: string) => ({ ...REP, facial: 0, hair: ix(name), band: 2 });
const cell = (label: string, html: string) => `<div style="text-align:center;font:12px sans-serif">${html}<div>${label}</div></div>`;
const row = (cells: string[]) => `<div style="display:flex;gap:18px;align-items:flex-end;margin:10px 0">${cells.join("")}</div>`;

const lhc = look("Long Headband Curls");
const sizes = [48, 96, 180, 300];
const THIN = ["Short dreads", "Big afro", "Braids", "Twists", "Quiff", "Medium straight", "Messy", "Bowl cut", "Curly crop", "Brazilian Crescent", "Lion Afro", "Dutch Dreads"];
const body =
  `<h3>Long Headband Curls ${tag}</h3>` +
  row(sizes.map((s) => cell(`${s}px`, B(lhc, s, REP_O)))) +
  row([cell("48px ×4", `<div style="zoom:4">${B(lhc, 48, REP_O)}</div>`)]) +
  `<h3>Styles thinned for 48px ${tag}: actual size, then ×3</h3>` +
  row(THIN.map((n) => cell(n, B(look(n), 48, REP_O)))) +
  row(THIN.map((n) => cell("", `<div style="zoom:3">${B(look(n), 48, REP_O)}</div>`)));
writeFileSync(join(out, "lod.html"), `<!doctype html><meta charset=utf8><body style="margin:14px;background:#ddd5c4">${body}`);
