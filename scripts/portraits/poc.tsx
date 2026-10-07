/**
 * Proof-of-concept sheets for the improved portrait renderer (portrait-next), compared with the current one.
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/poc.tsx <out-dir>
 * ab: one representative player, current (A) vs improved (B) at small, medium and large sizes
 * bald: the same player bald and clean shaven (B), plus A for reference
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PortraitArt, VIEW } from "../../src/components/art/portrait/art";
import { modelFor } from "../../src/components/art/portrait/specs";
import { PortraitNext, detailFor, viewFor } from "../../src/components/art/portrait-next/art";
import { nextModelFor } from "../../src/components/art/portrait-next/model";
import { COLLARS, type Collar } from "../../src/components/art/portrait-next/kit";
import type { Appearance } from "../../src/engine/types";

const out = process.argv[2] ?? "portrait-poc";
mkdirSync(out, { recursive: true });

/** A fictional player: strong jaw, hooded eyes, soft-angled brows, straight nose, neutral mouth, light stubble. */
export const REP: Appearance = {
  v: 2, skin: 3, face: 9, hair: 7, hairColor: 2, brow: 3, browColor: 2, eyes: 4, eyeColor: 2, nose: 0, mouth: 0, facial: 1, facialColor: 2, ear: 1,
  freckles: 0, scar: 0, mark: 0, accessory: 0, headW: 50, headH: 50, eyeSp: 50, browAng: 50, noseSc: 50, earSc: 50, aging: 62,
};
const AGE = 26;
const KIT = "#b5232f";
const REP_O = { collar: "ribbed" as Collar };
const BALD_O = { ...REP_O, hairStyle: "none" };
const TRIM = "#f1ead8";
const BG = "#2f3e55";

let n = 0;
const frame = (size: number, art: ReturnType<typeof createElement>, v = VIEW) =>
  renderToStaticMarkup(createElement("svg", { width: size, height: Math.round((size * v.h) / v.w), viewBox: `${v.x} ${v.y} ${v.w} ${v.h}` }, art));
export const A = (a: Appearance, size: number, age = AGE) => frame(size, createElement(PortraitArt, { m: modelFor(a, age, KIT, TRIM, BG), uid: `a${n++}`, textured: size >= 96, lite: size < 96 }));
export const B = (a: Appearance, size: number, o: { age?: number; kit?: string; collar?: Collar; bg?: string; hairStyle?: string; view?: { x: number; y: number; w: number; h: number } } = {}) =>
  frame(
    size,
    createElement(PortraitNext, {
      m: { ...nextModelFor(a, o.age ?? AGE, o.kit ?? KIT, TRIM, o.bg ?? BG), ...(o.collar ? { collar: o.collar } : {}), ...(o.hairStyle ? { hairStyle: o.hairStyle } : {}) },
      uid: `b${n++}`,
      d: detailFor(size),
    }),
    o.view ?? viewFor(detailFor(size)),
  );

const cell = (label: string, svg: string) => `<figure><figcaption>${label}</figcaption>${svg}</figure>`;
export const page = (title: string, rows: string[]) =>
  `<!doctype html><meta charset=utf8><style>body{margin:0;padding:14px;background:#ddd5c4;font:13px sans-serif;color:#222}h3{margin:4px 0 10px}.r{display:flex;gap:14px;align-items:flex-end;margin-bottom:18px;flex-wrap:wrap}figure{margin:0}figcaption{margin-bottom:4px;font-weight:600}</style><h3>${title}</h3>${rows.map((r) => `<div class=r>${r}</div>`).join("")}`;

if (process.argv[1]?.endsWith("poc.tsx")) {
  const bald: Appearance = { ...REP, hair: 0, facial: 0 };
  writeFileSync(
    join(out, "ab.html"),
    page("A = current renderer · B = improved (same player, same data)", [
      [cell("A 48px", A(REP, 48)), cell("B 48px", B(REP, 48, REP_O)), cell("A 72px", A(REP, 72)), cell("B 72px", B(REP, 72, REP_O)), cell("A 120px", A(REP, 120)), cell("B 120px", B(REP, 120, REP_O))].join(""),
      [cell("A large", A(REP, 380)), cell("B large", B(REP, 380, REP_O))].join(""),
    ]),
  );
  writeFileSync(join(out, "zoom.html"), page("B close-up", [cell("B 760px", B(REP, 760, REP_O))]));
  writeFileSync(
    join(out, "bald.html"),
    page("Bald, clean shaven", [[cell("A", A(bald, 300)), cell("B", B(bald, 300, BALD_O)), cell("B 120px", B(bald, 120, BALD_O)), cell("B 48px", B(bald, 48, BALD_O))].join("")]),
  );
  writeFileSync(
    join(out, "skins.html"),
    page("Tone-aware shading: the same bald player in all 10 skin tones", [
      Array.from({ length: 10 }, (_, i) => cell(`skin ${i}`, B({ ...bald, skin: i }, 200, BALD_O))).join(""),
      Array.from({ length: 10 }, (_, i) => cell(`skin ${i}`, B({ ...REP, skin: i, hairColor: i > 5 ? 0 : 2 }, 120))).join(""),
    ]),
  );
  writeFileSync(join(out, "collars.html"), page("Collars", [COLLARS.map((c, i) => cell(c, B(REP, 220, { collar: c, kit: ["#b5232f", "#1d4ea8", "#2e8b57", "#e2b007", "#f1ead8"][i] }))).join("")]));
  // Neck into shirt: every collar against narrow, medium and wide necks (and a long face whose chin nears the
  // collar), each with a close crop of the neckline.
  const combos: [string, Appearance, number][] = [
    ["narrow neck (Narrow face, head width 0, age 18)", { ...REP, face: 5, headW: 0 }, 18],
    ["medium (representative)", REP, 26],
    ["wide neck (Broad face, head width 100)", { ...REP, face: 6, headW: 100 }, 30],
    ["long face, head height 100", { ...REP, face: 7, headH: 100, headW: 30 }, 24],
  ];
  const crop = { x: 70, y: 236, w: 160, h: 110 };
  writeFileSync(
    join(out, "neck.html"),
    page(
      "Neck into shirt: each collar × neck width (portrait, then a close crop of the neckline)",
      COLLARS.map((c) =>
        combos.map(([label, a, age]) => cell(`${c} · ${label}`, B(a, 170, { collar: c, age }) + B(a, 300, { collar: c, age, view: crop }))).join(""),
      ),
    ),
  );
  writeFileSync(join(out, "fixed.html"), page("Same portrait as the screenshot, after the fix", [cell("B", B(REP, 1000, REP_O))]));
  console.log("wrote", out);
}
