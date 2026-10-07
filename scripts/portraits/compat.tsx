/**
 * Compatibility review sheets for the improved renderer: iconic hair, faces x hair, faces x beards, accessories and
 * stress combinations. Every portrait comes from stored appearance values (no style overrides), so it is exactly what
 * a player with that look would get.
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/compat.tsx <out-dir>   (then: W=2000 node scripts/portraits/shoot.mjs <out-dir>)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { B, REP, REP_O } from "./poc";
import type { Appearance } from "../../src/engine/types";

const out = process.argv[2] ?? "portrait-compat";
mkdirSync(out, { recursive: true });
const only = process.env.SHEET;

// Option indices (see src/engine/appearance/options.ts).
const H = { crop: 7, curlyFade: 8, afro: 10, dreads: 17, longFlow: 23, curtains: 24, mullet: 29, shaved: 0, crescent: 39, hawk: 40, curls: 41, lion: 42, pony: 43, dutch: 44 } as const;
const ICONIC: [string, number, Partial<Appearance>][] = [
  ["Brazilian Crescent", H.crescent, {}],
  ["Frosted Faux Hawk", H.hawk, { hairTip: 1 }],
  ["Long Headband Curls", H.curls, { band: 2 }],
  ["Lion Afro", H.lion, { hairTip: 2 }],
  ["Divine Ponytail", H.pony, { band: 1 }],
  ["Dutch Dreads", H.dutch, {}],
];
const base: Appearance = { ...REP, facial: 0 };
const FACES: [string, Partial<Appearance>][] = [
  ["Narrow · head width 0", { face: 5, headW: 0, headH: 50, skin: 2 }],
  ["Broad · head width 100", { face: 6, headW: 100, headH: 40, skin: 7 }],
  ["Long · head height 100", { face: 7, headW: 30, headH: 100, skin: 4 }],
  ["Round · short head", { face: 1, headW: 70, headH: 0, aging: 15, skin: 8 }],
];
const css = `body{margin:0;padding:14px;background:#ddd5c4;font:13px sans-serif;color:#222}h3{margin:2px 0 10px}.row{display:grid;gap:10px;margin-bottom:12px;align-items:center}.lab{font-weight:600}.c{display:flex;flex-direction:column;gap:4px}.c small{color:#555}`;
const grid = (cols: number, w: number, first = 0) => `grid-template-columns:${first ? `${first}px ` : ""}repeat(${cols},${w}px)`;
const row = (style: string, cells: string[]) => `<div class=row style="${style}">${cells.join("")}</div>`;
const sheet = (name: string, title: string, body: string) => {
  if (only && only !== name) return;
  writeFileSync(join(out, `${name}.html`), `<!doctype html><meta charset=utf8><style>${css}</style><h3>${title}</h3>${body}`);
};
const look = (a: Partial<Appearance>): Appearance => ({ ...base, ...a });

// A: the six iconic styles on the same face — portrait, pure black silhouette, 48px, 48px silhouette.
{
  const g = grid(6, 228);
  sheet(
    "A-iconic",
    "A · Iconic hair on the same face — portrait, black silhouette, 96px, 48px, 48px silhouette",
    row(g, ICONIC.map(([l]) => `<div class=lab>${l}</div>`)) +
      row(g, ICONIC.map(([, hair, x]) => B(look({ hair, ...x }), 220, REP_O))) +
      row(g, ICONIC.map(([, hair, x]) => B(look({ hair, ...x }), 220, { ...REP_O, silhouette: true }))) +
      row(g, ICONIC.map(([, hair, x]) => `<div style="display:flex;gap:6px;align-items:end">${B(look({ hair, ...x }), 96, REP_O)}${B(look({ hair, ...x }), 48, REP_O)}${B(look({ hair, ...x }), 48, { ...REP_O, silhouette: true })}</div>`)),
  );
}

// B: four faces x six iconic styles.
{
  const g = grid(6, 188, 150);
  sheet(
    "B-faces-iconic",
    "B · Four faces × six iconic styles",
    row(g, [`<div></div>`, ...ICONIC.map(([l]) => `<div class=lab>${l}</div>`)]) +
      FACES.map(([label, fa]) => row(g, [`<div class=lab>${label}</div>`, ...ICONIC.map(([, hair, x]) => B(look({ ...fa, hair, ...x }), 180, REP_O))])).join(""),
  );
}

// C: faces x beards.
{
  const BEARDS: [string, number][] = [
    ["Clean", 0],
    ["Light stubble", 1],
    ["Short beard", 8],
    ["Full beard", 10],
    ["Goatee", 5],
    ["Moustache", 3],
    ["Long beard", 11],
  ];
  const faces: [string, Partial<Appearance>][] = [...FACES, ["Strong jaw (reference)", { face: 9 }], ["Diamond", { face: 4, skin: 5 }]];
  const g = grid(7, 168, 150);
  sheet(
    "C-beards",
    "C · Faces × facial hair (beard colour follows the hair)",
    row(g, [`<div></div>`, ...BEARDS.map(([l]) => `<div class=lab>${l}</div>`)]) +
      faces.map(([label, fa]) => row(g, [`<div class=lab>${label}</div>`, ...BEARDS.map(([, facial]) => B(look({ ...fa, hair: H.crop, facial, aging: 70 }), 160, REP_O))])).join(""),
  );
}

// D: accessories x (face, hair) pairs.
{
  const PAIRS: [string, Partial<Appearance>][] = [
    ["Narrow · Short Textured", { face: 5, headW: 0, hair: H.crop }],
    ["Broad · Medium Afro", { face: 6, headW: 100, hair: H.afro, skin: 8 }],
    ["Long · Long Flow", { face: 7, headH: 100, hair: H.longFlow, skin: 1 }],
    ["Round · Curly Fade", { face: 1, headH: 0, hair: H.curlyFade, skin: 6 }],
    ["Square · Divine Ponytail", { face: 2, hair: H.pony, skin: 3 }],
    ["Oval · Lion Afro", { face: 0, hair: H.lion, skin: 9 }],
    ["Heart · Frosted Faux Hawk", { face: 8, hair: H.hawk, hairTip: 3, skin: 2 }],
    ["Strong jaw · Medium Dreads", { face: 9, hair: H.dreads, skin: 7 }],
  ];
  const ACC: [string, Partial<Appearance>][] = [
    ["None", {}],
    ["Headband (red)", { accessory: 1, band: 2 }],
    ["Ear stud", { accessory: 2 }],
    ["Glasses", { accessory: 3 }],
    ["Freckles + cheek scar", { freckles: 1, scar: 1 }],
    ["Brow scar + mark", { scar: 2, mark: 2 }],
  ];
  const g = grid(8, 158, 130);
  sheet(
    "D-accessories",
    "D · Accessories and marks × face and hair",
    row(g, [`<div></div>`, ...PAIRS.map(([l]) => `<div class=lab>${l}</div>`)]) + ACC.map(([label, x]) => row(g, [`<div class=lab>${label}</div>`, ...PAIRS.map(([, p]) => B(look({ ...p, ...x }), 150, REP_O))])).join(""),
  );
}

// E: stress combinations.
{
  const STRESS: [string, Partial<Appearance>][] = [
    ["Wide face + Lion Afro + full beard + glasses", { face: 6, headW: 100, hair: H.lion, hairTip: 2, facial: 10, accessory: 3, skin: 8 }],
    ["Narrow + Dutch Dreads + moustache + ear stud", { face: 5, headW: 0, hair: H.dutch, facial: 3, accessory: 2, skin: 7 }],
    ["Round + Frosted Faux Hawk + stubble", { face: 1, headH: 0, hair: H.hawk, hairTip: 1, facial: 1, skin: 3 }],
    ["Angular + Divine Ponytail + short beard", { face: 4, hair: H.pony, facial: 8, band: 1, skin: 2 }],
    ["Long + Long Headband Curls + beauty mark", { face: 7, headH: 100, hair: H.curls, band: 3, mark: 1, skin: 5 }],
    ["Broad + Brazilian Crescent + full beard", { face: 6, headW: 100, hair: H.crescent, facial: 10, skin: 9 }],
    ["Long head + Lion Afro + goatee + headband", { face: 7, headH: 100, hair: H.lion, facial: 5, accessory: 1, band: 4, skin: 9 }],
    ["Short head + Dutch Dreads + glasses", { face: 1, headH: 0, headW: 80, hair: H.dutch, accessory: 3, skin: 6 }],
    ["Narrow + Long Headband Curls + long beard", { face: 5, headW: 0, hair: H.curls, facial: 11, band: 5, skin: 4 }],
    ["Square + Faux Hawk (no tips) + boxed beard + scar", { face: 2, hair: H.hawk, facial: 9, scar: 1, skin: 6 }],
    ["High cheekbones + Ponytail + glasses + freckles", { face: 10, hair: H.pony, accessory: 3, freckles: 1, skin: 1 }],
    ["Soft jaw + Medium Afro + mutton chops", { face: 11, hair: H.afro, facial: 14, skin: 8 }],
    ["Heart + Long Flow + headband + stubble", { face: 8, hair: H.longFlow, accessory: 1, band: 1, facial: 2, skin: 2 }],
    ["Diamond + Curtains + moustache + glasses", { face: 4, hair: H.curtains, facial: 3, accessory: 3, skin: 4 }],
    ["Rectangular + Mullet + chinstrap + stud", { face: 3, hair: H.mullet, facial: 15, accessory: 2, skin: 3 }],
    ["Age 36 + receding Crop + full beard", { face: 9, hair: H.crop, facial: 10, aging: 95, skin: 5 }],
    ["Wide + Medium Dreads + headband", { face: 6, headW: 100, hair: H.dreads, accessory: 1, band: 0, skin: 9 }],
    ["Long + Crescent + glasses + chin scar", { face: 7, headH: 100, hair: H.crescent, accessory: 3, scar: 3, skin: 7 }],
  ];
  const g = grid(6, 228);
  const cells = STRESS.map(([l, a]) => `<div class=c><small>${l}</small>${B(look(a), 220, { ...REP_O, age: l.startsWith("Age 36") ? 36 : 26 })}<div style="display:flex;gap:6px;align-items:end">${B(look(a), 64, REP_O)}${B(look(a), 48, REP_O)}</div></div>`);
  sheet("E-stress", "E · Stress combinations (220px, then 64px and 48px)", row(g, cells.slice(0, 6)) + row(g, cells.slice(6, 12)) + row(g, cells.slice(12)));
}

// Close-ups when ZOOM is set (inspection while iterating): the six iconic styles, or ZOOM=<hair index> for one.
if (process.env.ZOOM) {
  const pick = process.env.ZOOM === "1" ? ICONIC : ICONIC.filter(([, h]) => h === Number(process.env.ZOOM));
  writeFileSync(join(out, `zoom.html`), `<!doctype html><body style="margin:0;background:#ddd;display:grid;grid-template-columns:repeat(3,460px);gap:8px">${pick.map(([, hair, x]) => B(look({ hair, ...x }), 460, REP_O)).join("")}</body>`);
}
console.log("wrote", out);
