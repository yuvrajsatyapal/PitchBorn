/**
 * Proof-of-concept sheets for the illustrated pipeline (12 hairstyles).
 *
 *   npm run portraits:sheets
 *
 * Slots whose art has not been delivered show as labelled placeholder boxes in the colour they would take: these
 * sheets check alignment, layering, recolouring and fit transforms, and become the art review once files arrive.
 */
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FRAME, IllustratedArt } from "../../src/components/art/illustrated/IllustratedArt";
import { MANIFEST, missingFiles, selectArt } from "../../src/components/art/illustrated/select";
import { SLOTS } from "../../src/components/art/illustrated/slots";
import { POC_HAIRSTYLES, hairstyleById } from "../../src/engine/appearance/hairstyles";
import { generateAppearance } from "../../src/engine/appearance/generate";
import { FACE_SHAPES, HAIR_COLOR_IDS } from "../../src/engine/appearance/options";
import type { Appearance } from "../../src/engine/types";

const out = process.argv[2] ?? "portrait-sheets";
mkdirSync(out, { recursive: true });

/** The proof-of-concept base player: every feature is one of the first-test slots. */
const BASE: Appearance = { ...generateAppearance("poc-base"), face: 9, eyes: 0, brow: 0, nose: 0, mouth: 0, ear: 1, facial: 0, skin: 4, eyeColor: 1, hairColor: 2, browColor: 2, facialColor: 2, accessory: 0, freckles: 0, scar: 0, mark: 0, headW: 50, headH: 50, eyeSp: 50, browAng: 45, noseSc: 50, earSc: 50, aging: 90 };
const faceIndex = (name: string) => FACE_SHAPES.findIndex((f) => f.name === name);
const colorIndex = (id: string) => (HAIR_COLOR_IDS as readonly string[]).indexOf(id);

let n = 0;
const card = (a: Appearance, hairstyle: string, size: number, caption: string): ReactElement => {
  const sel = selectArt(a, 25, "#b5232f", "#f1ead8", undefined, { hairstyle });
  return createElement("figure", { key: n, style: { margin: 0 } }, [
    createElement("svg", { key: "s", width: size, height: Math.round((size * FRAME.h) / FRAME.w), viewBox: `${FRAME.x} ${FRAME.y} ${FRAME.w} ${FRAME.h}` }, createElement(IllustratedArt, { sel, uid: `c${n++}`, textured: size >= 96, preview: true })),
    createElement("figcaption", { key: "c", style: { font: "11px sans-serif", maxWidth: size } }, caption),
  ]);
};
const page = (title: string, note: string, cells: ReactElement[]) =>
  `<!doctype html><meta charset=utf8><style>body{margin:0;padding:14px;background:#ddd5c4;font:13px sans-serif}.g{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}</style><h3 style="margin:0 0 4px">${title}</h3><p style="margin:0 0 10px;max-width:900px">${note}</p><div class=g>${renderToStaticMarkup(createElement("div", { className: "g" }, cells))}</div>`;

const missing = new Set(POC_HAIRSTYLES.flatMap((id) => missingFiles(selectArt(BASE, 25, "#b5232f", "#f1ead8", undefined, { hairstyle: id }))));
const status = `${Object.keys(MANIFEST).length} layer files delivered; ${missing.size} still needed for these cards. Dashed boxes are placeholders, not artwork.`;

writeFileSync(join(out, "poc-hairstyles.html"), page("12 proof-of-concept hairstyles, same base player", status, POC_HAIRSTYLES.map((id) => card(BASE, id, 200, hairstyleById(id)!.name))));

const faces = ["Strong jaw", "Long", "Round", "Diamond"];
const test = ["textured-crop", "medium-afro", "classic-curtains", "long-headband"];
writeFileSync(join(out, "poc-faces.html"), page("Same hairstyles on different faces", "Hair is drawn on the standard skull and fitted to each face (FACE_FIT).", faces.flatMap((f) => test.map((id) => card({ ...BASE, face: faceIndex(f) }, id, 150, `${f} · ${hairstyleById(id)!.name}`)))));

const colors = ["jet-black", "dark-brown", "ginger", "platinum"];
writeFileSync(join(out, "poc-colours.html"), page("Hair colour on the same art", "The base mask takes the colour; drawn shadows, highlights and ink stay the same.", ["medium-afro", "classic-curtains", "frosted-faux-hawk"].flatMap((id) => colors.map((c) => card({ ...BASE, hairColor: colorIndex(c) }, id, 130, `${hairstyleById(id)!.name} · ${c}`)))));

writeFileSync(join(out, "poc-sizes.html"), page("Small sizes", "48 / 64 / 96 / 256 px.", [48, 64, 96, 256].flatMap((s) => ["brazilian-crescent", "lion-mane"].map((id) => card(BASE, id, s, `${s}px`)))));

const poc = SLOTS.filter((s) => s.poc);
const rows = poc.flatMap((s) => s.roles.map((r) => `<tr><td>${MANIFEST[`${s.path}/${r}`] ? "✓" : "—"}</td><td>art/portrait/source/${s.path}/${r}.png</td></tr>`));
writeFileSync(join(out, "poc-checklist.html"), `<!doctype html><meta charset=utf8><body style="font:13px monospace;padding:14px"><h3>First art test: ${rows.length} layer files</h3><table>${rows.join("")}</table>`);
console.log("wrote", out, "|", status);
