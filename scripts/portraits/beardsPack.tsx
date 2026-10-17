/**
 * Review sheets for Imperial Goatee, Sharp Chinstrap, Maestro Beard and Rising Stubble, drawn by the real renderer.
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/beardsPack.tsx <out-dir> [style-name]
 *   CHROMIUM=<chrome> W=1700 node scripts/portraits/shoot.mjs <out-dir>
 * Writes one sheet per style (ten rows, see docs/BEARD_EXPANSION.md) and a master comparison with the five baseline beards.
 * The silhouette row calls the beard drawing directly, in black, on a plain head; for Rising Stubble it draws the same
 * density in black as a monochrome test.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { anchorsFor } from "../../src/components/art/portrait-next/anchors";
import { PortraitNext, detailFor, viewFor } from "../../src/components/art/portrait-next/art";
import { BeardNext, RisingStubbleNext } from "../../src/components/art/portrait-next/facialHair";
import { buildHeadNext } from "../../src/components/art/portrait-next/head";
import { withDetail } from "../../src/components/art/portrait-next/ink";
import { nextModelFor } from "../../src/components/art/portrait-next/model";
import { skinTones } from "../../src/components/art/portrait-next/palette";
import { CX } from "../../src/components/art/portrait/geometry";
import { generateAppearance } from "../../src/engine/appearance/generate";
import { ACCESSORIES, FACIAL_HAIR, HAIR_COLOR_NAMES, HAIR_STYLES } from "../../src/engine/appearance/options";
import type { Appearance } from "../../src/engine/types";
import { REP } from "./poc";

const out = process.argv[2] ?? "x";
const focus = process.argv[3] === "focus";
const only = focus ? undefined : process.argv[3];
mkdirSync(out, { recursive: true });

const KIT = "#b5232f";
const TRIM = "#f1ead8";
const BG = "#2f3e55";
const style = (name: string) => FACIAL_HAIR.indexOf(name as (typeof FACIAL_HAIR)[number]);
const hairIx = (re: RegExp) => Math.max(0, HAIR_STYLES.findIndex((h) => re.test(h.name)));
const base: Appearance = { ...REP, facial: 0, hair: 7, hairColor: 3, facialColor: 3, accessory: 0, scar: 0, mark: 0, freckles: 0, hairTip: 0, band: 0 };

type View = { x: number; y: number; w: number; h: number };
let n = 0;
const model = (a: Appearance, age = 26) => nextModelFor(a, age, KIT, TRIM, BG);
const draw = (a: Appearance, size = 240, o: { view?: View; age?: number; facialColor?: string } = {}) => {
  const d = detailFor(size);
  const v = o.view ?? viewFor(d);
  const m = { ...model(a, o.age), ...(o.facialColor ? { facialColor: o.facialColor } : {}) };
  return renderToStaticMarkup(createElement("svg", { width: size, height: Math.round((size * v.h) / v.w), viewBox: `${v.x} ${v.y} ${v.w} ${v.h}` }, createElement(PortraitNext, { m, uid: `s${n++}`, d })));
};

/** Facial hair alone on a plain light head: black (silhouette) or a monochrome density test. */
const isolate = (a: Appearance, size: number, view?: View) => {
  const d = detailFor(size);
  const v = view ?? viewFor(d);
  const m = model(a);
  const head = buildHeadNext(m.f);
  const anchors = anchorsFor(m.f, head);
  const t = skinTones("#ffffff");
  const uid = `i${n++}`;
  const rising = a.facial === 19;
  const body = withDetail(d, () =>
    rising
      ? RisingStubbleNext({ f: m.f, head, a: anchors, t, color: "#000000", youth: 0, d, uid, pSeed: m.seed })
      : BeardNext({ f: m.f, head, a: anchors, t, style: a.facial, color: "#000000", youth: 0, d, uid, pSeed: m.seed }),
  );
  return renderToStaticMarkup(
    createElement(
      "svg",
      { width: size, height: Math.round((size * v.h) / v.w), viewBox: `${v.x} ${v.y} ${v.w} ${v.h}` },
      createElement("defs", null, createElement("clipPath", { id: `${uid}c` }, createElement("path", { d: head.path }))),
      createElement("rect", { x: v.x, y: v.y, width: v.w, height: v.h, fill: "#fff" }),
      createElement("path", { d: head.path, fill: rising ? "#fff" : "#e6e6e6", stroke: "#bbb", strokeWidth: 1 }),
      createElement("g", { clipPath: rising ? `url(#${uid}c)` : undefined, filter: rising ? undefined : `url(#${uid}k)` }, body),
      !rising && createElement("defs", null, createElement("filter", { id: `${uid}k` }, createElement("feColorMatrix", { type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" }))),
    ),
  );
};

const FACES: [string, Partial<Appearance>][] = [
  ["Narrow / long", { face: 5, headW: 0, headH: 70 }],
  ["Wide / square", { face: 2, headW: 100, headH: 30 }],
  ["Round", { face: 1, headW: 70, headH: 0 }],
  ["Angular / diamond", { face: 4, headW: 40, headH: 50 }],
];
const MORE: [string, Partial<Appearance>][] = [
  ["Oval", { face: 0, headW: 50, headH: 50 }],
  ["Broad strong jaw", { face: 9, headW: 80, headH: 40 }],
  ["Long chin", { face: 7, headW: 30, headH: 100 }],
  ["Heart", { face: 8, headW: 50, headH: 40 }],
  ["Narrowest", { face: 5, headW: 0, headH: 50 }],
  ["Widest", { face: 6, headW: 100, headH: 40 }],
];
const css = `body{margin:0;padding:14px;background:#ddd5c4;font:13px sans-serif;color:#222}h3{margin:2px 0 10px}h4{margin:14px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#555}.row{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:10px;align-items:flex-end}.c{display:flex;flex-direction:column;gap:4px}.c small{color:#555}`;
const cell = (l: string, svg: string) => `<div class=c><b>${l}</b>${svg}</div>`;
const row = (title: string, cells: string[]) => `<h4>${title}</h4><div class=row>${cells.join("")}</div>`;
const page = (name: string, title: string, body: string) => writeFileSync(join(out, `${name}.html`), `<!doctype html><meta charset=utf8><style>${css}</style><h3>${title}</h3>${body}`);

/** Close-up windows round the features of this face (in canvas units, 5:4). */
const views = (a: Appearance): [string, View][] => {
  const f = model(a).f;
  const win = (cx: number, cy: number, w: number): View => ({ x: cx - w / 2, y: cy - (w * 0.8) / 2, w, h: w * 0.8 });
  return [
    ["Mouth", win(CX, f.mouthY, 100)],
    ["Moustache", win(CX, f.mouthY - 6, 110)],
    ["Chin", win(CX, f.chinY - 12, 120)],
    ["Jawline (right)", win(CX + 50, f.jawY + 6, 120)],
    ["Sideburn (right)", win(CX + 62, f.ear.bot - 6, 90)],
  ];
};

const COLOURS: [string, number][] = [["Natural black", 1], ["Dark brown", 2], ["Blonde", 6], ["Ginger", 7], ["White", 9]];
const COMPARE: Record<string, string[]> = {
  "Imperial Goatee": ["Moustache", "Short beard", "Moustache + goatee"],
  "Sharp Chinstrap": ["Short beard", "Full beard", "Chinstrap"],
  "Maestro Beard": ["Full beard", "Short beard", "Long beard"],
  "Rising Stubble": ["Clean shaven", "Light stubble", "Heavy stubble"],
};
const HAIRS: [string, number][] = [["Crown Taper", hairIx(/crown taper/i)], ["Slickback Flow", hairIx(/slickback/i)], ["Warrior Knot", hairIx(/warrior knot/i)], ["Long Flow", hairIx(/long flow/i)], ["Medium Afro", hairIx(/medium afro/i)], ["Nordic Sweep", hairIx(/nordic sweep/i)]];
const glasses = ACCESSORIES.indexOf("Glasses");
const stud = ACCESSORIES.indexOf("Ear stud");

function sheet(name: string) {
  const s = style(name);
  const A = (extra: Partial<Appearance> = {}): Appearance => ({ ...base, ...extra, facial: s });
  const slug = name.toLowerCase().replace(/ /g, "-");
  const silhouette = (a: Appearance, size: number, view?: View) => isolate(a, size, view);
  const sections = [
    row("1 · Default portrait", [cell(name, draw(A(), 420)), cell("Lower face", draw(A(), 560, { view: { x: 70, y: 150, w: 160, h: 170 } }))]),
    row(s === 19 ? "2 · Monochrome density test (black on white)" : "2 · Facial-hair silhouette (pure black)", [cell("Default face", silhouette(A(), 340)), ...FACES.slice(0, 3).map(([l, f]) => cell(l, silhouette(A(f), 300)))]),
    row("3 · Small portraits", [cell("48px", draw(A(), 48)), cell("48px ×3 (same art)", `<div style="zoom:3">${draw(A(), 48)}</div>`), cell("64px", draw(A(), 64)), cell("96px", draw(A(), 96)), cell("160px", draw(A(), 160))]),
    row("4 · Face fitting", FACES.map(([l, f]) => cell(l, draw(A(f), 290)))),
    row("5 · More head shapes", MORE.map(([l, f]) => cell(l, draw(A(f), 220)))),
    row("6 · Hair and accessory compatibility", [
      ...HAIRS.slice(0, 4).map(([l, h]) => cell(l, draw(A({ hair: h }), 240))),
      cell("Glasses", draw(A({ accessory: glasses }), 240)),
      cell("Ear stud + scar + mark", draw(A({ accessory: stud, scar: 1, mark: 1 }), 240)),
      ...HAIRS.slice(4).map(([l, h]) => cell(l, draw(A({ hair: h }), 240))),
    ]),
    row("7 · Beard colour (light skin, then dark skin)", [
      ...COLOURS.map(([l, c]) => cell(l, draw(A({ facialColor: c, hairColor: c, skin: 2 }), 220))),
      ...COLOURS.map(([l, c]) => cell(`${l} · dark skin`, draw(A({ facialColor: c, hairColor: c, skin: 8 }), 220))),
    ]),
    row("8 · Seeded players (same style, different people)", Array.from({ length: 5 }, (_, i) => {
      const g = generateAppearance(`beards-pack-${slug}-${i}`);
      return cell(`player ${i + 1}`, draw({ ...g, facial: s, accessory: 0 }, 220));
    })),
    row("9 · Beside the closest existing styles", [cell(`${name} (new)`, draw(A(), 250)), ...COMPARE[name].map((c) => cell(c, draw({ ...base, facial: style(c) }, 250)))]),
    row("10 · Close-ups", views(A()).map(([l, v]) => cell(l, draw(A(), 340, { view: v })))),
  ];
  page(slug, `${name} — review sheet (rendered by the real portrait renderer)`, sections.join(""));
}

if (focus) {
  const lower = { x: 70, y: 170, w: 160, h: 140 };
  const names = ["Imperial Goatee", "Sharp Chinstrap", "Maestro Beard", "Rising Stubble"];
  page("focus", "focus", [{}, FACES[0][1], FACES[1][1]].map((fa, i) => row(`face ${i}`, names.map((l) => cell(l, draw({ ...base, ...fa, facial: style(l) }, 420, { view: lower }))))).join(""));
  process.exit(0);
}
for (const name of ["Imperial Goatee", "Sharp Chinstrap", "Maestro Beard", "Rising Stubble"]) if (!only || only === name) sheet(name);

if (!only) {
  const ALL = ["Imperial Goatee", "Sharp Chinstrap", "Maestro Beard", "Rising Stubble", "Clean shaven", "Light stubble", "Short beard", "Full beard", "Moustache"];
  const lower = { x: 70, y: 150, w: 160, h: 170 };
  page(
    "master",
    "Master comparison — four new beards and the five baseline options",
    row("Default face", ALL.map((l) => cell(l, draw({ ...base, facial: style(l) }, 230)))) +
      row("Lower face", ALL.map((l) => cell(l, draw({ ...base, facial: style(l) }, 230, { view: lower })))) +
      row("48px", ALL.map((l) => cell(l, draw({ ...base, facial: style(l) }, 48)))) +
      row("96px", ALL.map((l) => cell(l, draw({ ...base, facial: style(l) }, 96)))) +
      row("Narrow face", ALL.map((l) => cell(l, draw({ ...base, ...FACES[0][1], facial: style(l) }, 200)))) +
      row("Wide face", ALL.map((l) => cell(l, draw({ ...base, ...FACES[1][1], facial: style(l) }, 200)))) +
      row("Round face", ALL.map((l) => cell(l, draw({ ...base, ...FACES[2][1], facial: style(l) }, 200)))),
  );
}
console.log("wrote", out, HAIR_COLOR_NAMES.length);
