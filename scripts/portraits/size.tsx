/**
 * Markup cost of the improved portrait per hair design and size, next to the current renderer.
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/size.tsx
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PortraitNext, detailFor } from "../../src/components/art/portrait-next/art";
import { HAIR_LIBRARY } from "../../src/components/art/portrait-next/hair";
import { nextModelFor } from "../../src/components/art/portrait-next/model";
import { PortraitArt } from "../../src/components/art/portrait/art";
import { modelFor } from "../../src/components/art/portrait/specs";
import { generateAppearance } from "../../src/engine/appearance/generate";

const base = { ...generateAppearance("size"), face: 9, facial: 1 };
const els = (s: string) => (s.match(/<(path|circle|rect|use|ellipse)\b/g) ?? []).length;
const fmt = (s: string) => `${String(els(s)).padStart(3)} el ${(s.length / 1024).toFixed(1).padStart(5)} KB`;
const LEGACY: Record<string, number> = { shaved: 0, "textured-crop": 7, "curly-fade": 8, "medium-afro": 10, "medium-dreads": 17, "long-flow": 23, "classic-curtains": 24, "classic-mullet": 29 };
const next = (id: string, px: number) =>
  renderToStaticMarkup(createElement("svg", null, createElement(PortraitNext, { m: { ...nextModelFor(base, 26, "#c8102e", "#f1ead8"), hairStyle: id }, uid: "x", d: detailFor(px) })));
const current = (hair: number, px: number) => renderToStaticMarkup(createElement("svg", null, createElement(PortraitArt, { m: modelFor({ ...base, hair }, 26, "#c8102e", "#f1ead8"), uid: "y", textured: px >= 96, lite: px < 96 })));
console.log("design".padEnd(20), "new 48px".padEnd(18), "new 96px".padEnd(18), "new 220px".padEnd(18), "current 48px".padEnd(18), "current 220px");
for (const h of HAIR_LIBRARY) {
  const li = LEGACY[h.id];
  console.log(h.id.padEnd(20), fmt(next(h.id, 48)).padEnd(18), fmt(next(h.id, 96)).padEnd(18), fmt(next(h.id, 220)).padEnd(18), li === undefined ? "-".padEnd(18) : fmt(current(li, 48)).padEnd(18), li === undefined ? "-" : fmt(current(li, 220)));
}
