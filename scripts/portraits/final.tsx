/**
 * Final review sheets for the improved renderer: the six iconic styles, their silhouettes, the iconic styles at
 * 48px, dark skin with dark hair, the chinstrap, and 50 randomly generated players (no hand-picked combinations).
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/final.tsx <out-dir>   (then: W=1700 node scripts/portraits/shoot.mjs <out-dir>)
 * SHEET=<name> writes one sheet; TAG=<text> is added to the titles (e.g. "before").
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { B, REP, REP_O } from "./poc";
import { POC_IDS } from "../../src/components/art/portrait-next/hair";
import { COLLARS } from "../../src/components/art/portrait-next/kit";
import { generateAppearance } from "../../src/engine/appearance/generate";
import { ACCESSORIES, FACE_SHAPES, FACIAL_HAIR, HAIR_COLOR_NAMES, HAIR_STYLES, SKIN_NAMES } from "../../src/engine/appearance/options";
import { Rng } from "../../src/engine/rng";
import type { Appearance } from "../../src/engine/types";

const out = process.argv[2] ?? "portrait-final";
mkdirSync(out, { recursive: true });
const only = process.env.SHEET;
const tag = process.env.TAG ? ` (${process.env.TAG})` : "";

const css = `body{margin:0;padding:14px;background:#ddd5c4;font:13px sans-serif;color:#222}h3{margin:2px 0 10px}h4{margin:14px 0 6px}.row{display:grid;gap:10px;margin-bottom:12px;align-items:center}.lab{font-weight:600}.c{display:flex;flex-direction:column;gap:3px}.c small{color:#444;font-size:11px;line-height:1.25}`;
const grid = (cols: number, w: number, first = 0) => `grid-template-columns:${first ? `${first}px ` : ""}repeat(${cols},${w}px)`;
const row = (style: string, cells: string[]) => `<div class=row style="${style}">${cells.join("")}</div>`;
const sheet = (name: string, title: string, body: string) => {
  if (only && only !== name) return;
  writeFileSync(join(out, `${name}.html`), `<!doctype html><meta charset=utf8><style>${css}</style><h3>${title}${tag}</h3>${body}`);
};
const hairIx = (name: string) => HAIR_STYLES.findIndex((h) => h.name === name);
const base: Appearance = { ...REP, facial: 0 };
const look = (a: Partial<Appearance>): Appearance => ({ ...base, ...a });
const GOLDEN = HAIR_COLOR_NAMES.indexOf("Golden" as never);

const ICONIC: [string, Partial<Appearance>][] = [
  ["Brazilian Crescent", { hair: hairIx("Brazilian Crescent") }],
  ["Frosted Faux Hawk", { hair: hairIx("Frosted Faux Hawk"), hairTip: 1 }],
  ["Long Headband Curls", { hair: hairIx("Long Headband Curls"), band: 2 }],
  ["Lion Afro (golden)", { hair: hairIx("Lion Afro"), hairColor: GOLDEN >= 0 ? GOLDEN : 6 }],
  ["Divine Ponytail", { hair: hairIx("Divine Ponytail"), band: 1 }],
  ["Dutch Dreads", { hair: hairIx("Dutch Dreads") }],
];

// A + B + C: the six iconic styles on the same face; silhouettes; 48px.
{
  const g = grid(6, 236);
  const labels = row(g, ICONIC.map(([l]) => `<div class=lab>${l}</div>`));
  sheet("A-iconic", "A · Six iconic hairstyles, same face", labels + row(g, ICONIC.map(([, a]) => B(look(a), 228, REP_O))));
  sheet("B-silhouettes", "B · Silhouettes (hair in pure black)", labels + row(g, ICONIC.map(([, a]) => B(look(a), 228, { ...REP_O, silhouette: true }))));
  const sm = grid(6, 120);
  sheet(
    "C-48px",
    "C · Iconic styles at 48px (portrait, then silhouette), and at 64px",
    row(sm, ICONIC.map(([l]) => `<small>${l}</small>`)) +
      row(sm, ICONIC.map(([, a]) => `<div style="display:flex;gap:6px;align-items:end">${B(look(a), 48, REP_O)}${B(look(a), 48, { ...REP_O, silhouette: true })}</div>`)) +
      row(sm, ICONIC.map(([, a]) => B(look(a), 64, REP_O))),
  );
}

// More colour checks on the Lion Afro and the faux hawk.
{
  const g = grid(6, 188);
  const lion = hairIx("Lion Afro");
  const hawk = hairIx("Frosted Faux Hawk");
  const colours: [string, number][] = [["Jet black", 0], ["Dark brown", 2], ["Chestnut", 3], ["Blond", 6], ["Golden", GOLDEN >= 0 ? GOLDEN : 6], ["Auburn", 8]];
  sheet(
    "A2-colours",
    "A2 · Lion Afro and Frosted Faux Hawk in different hair colours (hawk: without, then with frosted tips)",
    row(g, colours.map(([l]) => `<div class=lab>${l}</div>`)) +
      row(g, colours.map(([, hairColor]) => B(look({ hair: lion, hairColor, skin: 7 }), 180, REP_O))) +
      row(g, colours.map(([, hairColor]) => B(look({ hair: hawk, hairColor }), 180, REP_O))) +
      row(g, colours.map(([, hairColor]) => B(look({ hair: hawk, hairColor, hairTip: hairColor >= 5 ? 4 : 1 }), 180, REP_O))),
  );
  const crescent = hairIx("Brazilian Crescent");
  const heads: [string, Partial<Appearance>][] = [
    ["Narrow, head width 0", { face: 5, headW: 0 }],
    ["Wide, head width 100", { face: 6, headW: 100 }],
    ["Round, short head", { face: 1, headW: 70, headH: 0 }],
    ["Long, head height 100", { face: 7, headW: 30, headH: 100 }],
  ];
  sheet(
    "A3-crescent",
    "A3 · Brazilian Crescent on four heads",
    row(grid(4, 228), heads.map(([l]) => `<div class=lab>${l}</div>`)) + row(grid(4, 228), heads.map(([, h]) => B(look({ ...h, hair: crescent, skin: 6, hairColor: 0 }), 220, REP_O))),
  );
}

// D: dark skin with dark hair.
{
  const dark: [string, Partial<Appearance>][] = [
    ["Brazilian Crescent", { hair: hairIx("Brazilian Crescent") }],
    ["Short Textured + full beard", { hair: 7, facial: 10 }],
    ["Curly Fade + short beard", { hair: 8, facial: 8 }],
    ["Medium Afro + goatee", { hair: 10, facial: 5 }],
    ["Lion Afro + moustache", { hair: hairIx("Lion Afro"), facial: 3 }],
    ["Dutch Dreads + boxed beard", { hair: hairIx("Dutch Dreads"), facial: 9 }],
    ["Shaved + long beard", { hair: 0, facial: 11 }],
    ["Medium Dreads + chinstrap", { hair: 17, facial: 15 }],
  ];
  const g = grid(8, 188);
  const rows = ([[9, 0], [8, 0], [7, 1]] as const).map(([skin, hairColor]) => [
    `<h4>${SKIN_NAMES[skin]} skin, ${HAIR_COLOR_NAMES[hairColor]} hair</h4>`,
    row(g, dark.map(([l, a]) => `<div class=c><small>${l}</small>${B(look({ ...a, skin, hairColor, facialColor: hairColor, browColor: hairColor, face: [9, 6, 1, 4, 0, 5, 7, 2][a.hair! % 8] }), 180, REP_O)}</div>`)),
  ]);
  sheet("D-dark", "D · Dark skin with dark hair", rows.flat().join(""));
}

// E: chinstrap on several faces, with a close crop of the jaw.
{
  const faces: [string, Partial<Appearance>][] = [
    ["Strong jaw", { face: 9, skin: 3 }],
    ["Narrow", { face: 5, headW: 0, skin: 1 }],
    ["Broad", { face: 6, headW: 100, skin: 6 }],
    ["Round", { face: 1, headH: 0, skin: 4 }],
    ["Long", { face: 7, headH: 100, skin: 8, hairColor: 0, facialColor: 0 }],
  ];
  const g = grid(5, 228);
  const crop = { x: 70, y: 160, w: 160, h: 150 };
  sheet(
    "E-chinstrap",
    "E · Chinstrap",
    row(g, faces.map(([l]) => `<div class=lab>${l}</div>`)) +
      row(g, faces.map(([, f]) => B(look({ ...f, hair: 7, facial: 15 }), 220, REP_O))) +
      row(g, faces.map(([, f]) => B(look({ ...f, hair: 7, facial: 15 }), 220, { ...REP_O, view: crop }))),
  );
}

// F: 50 generated players. Looks come straight from the generator (iconic styles at their real rarity); a separate
// seeded roll spreads age and accessories (the generator alone almost never hands out glasses).
{
  const cells: string[] = [];
  for (let i = 0; i < 50; i++) {
    const a = generateAppearance(`stress-${i}`);
    const rng = Rng.fromSeed(`stress-extra-${i}`);
    const age = rng.int(17, 38);
    a.accessory = rng.int(0, ACCESSORIES.length - 1);
    const collar = COLLARS[rng.int(0, COLLARS.length - 1)];
    const h = HAIR_STYLES[a.hair];
    // Hairstyles without a new design yet are still drawn by the current hair code inside the new portrait.
    const label = `#${i} ${FACE_SHAPES[a.face]?.name ?? a.face} · ${SKIN_NAMES[a.skin]} · ${h.name}${h.iconic ? " ★" : ""}${POC_IDS[a.hair] ? "" : " (old hair)"} · ${HAIR_COLOR_NAMES[a.hairColor]} · ${FACIAL_HAIR[a.facial]} · ${ACCESSORIES[a.accessory]} · ${age}y`;
    cells.push(`<div class=c><small>${label}</small>${B(a, 160, { age, collar })}</div>`);
  }
  const g = grid(10, 164);
  sheet("F-random50", "F · 50 generated players (seeds stress-0 … stress-49, nothing hand-picked; ★ iconic; “old hair”: style not yet redesigned, drawn by the current hair code)", [0, 1, 2, 3, 4].map((r) => row(g, cells.slice(r * 10, r * 10 + 10))).join(""));
}
console.log("wrote", out);
