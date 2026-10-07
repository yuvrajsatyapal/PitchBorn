/**
 * Writes the artist's canvas guide from the same landmark constants the compositor uses, so they can never drift.
 *
 *   npm run portraits:guide
 *
 * art/portrait/guides/canvas-guide.svg (+ .png at 512 and 1024): landmark lines, the card frame, and the
 * placement box of every slot group. Draw each asset in place over this guide on a 512 x 512 transparent canvas.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { CANVAS, LANDMARKS as L } from "../../src/components/art/illustrated/canvas";
import { FRAME } from "../../src/components/art/illustrated/IllustratedArt";
import { SLOTS } from "../../src/components/art/illustrated/slots";

const lines: [string, number][] = [
  ["crown", L.crown], ["hairline", L.hairline], ["temple", L.temple.y], ["brow", L.brow], ["eye", L.eye.y], ["cheekbone", L.cheekbone.y],
  ["nose base", L.nose], ["mouth", L.mouth], ["jaw corner", L.jawCorner.y], ["chin", L.chin], ["collar", L.collar], ["shoulders", L.shoulders],
];
const groups = new Map<string, readonly [number, number, number, number]>();
for (const s of SLOTS) if (!groups.has(s.group) && s.group !== "texture") groups.set(s.group, s.region);
const colors = ["#e4572e", "#29335c", "#f3a712", "#669bbc", "#a8c686", "#8e44ad", "#16a085", "#c0392b", "#2c3e50", "#d35400", "#7f8c8d", "#27ae60"];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" font-family="sans-serif">
<rect width="${CANVAS}" height="${CANVAS}" fill="#f6f2e8"/>
<rect x="${FRAME.x}" y="${FRAME.y}" width="${FRAME.w}" height="${FRAME.h}" rx="28" fill="#fff" stroke="#999" stroke-dasharray="8 6"/>
<text x="${FRAME.x + 8}" y="${CANVAS - 8}" font-size="10" fill="#999">card frame (outside is cropped in the game)</text>
${[...groups].map(([g, r], i) => `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="1.5" opacity="0.7"/><text x="${r[0] + 3}" y="${r[1] + r[3] - 4}" font-size="9" fill="${colors[i % colors.length]}">${g}</text>`).join("\n")}
<line x1="${L.centreX}" y1="0" x2="${L.centreX}" y2="${CANVAS}" stroke="#c0392b" stroke-width="1"/>
${lines.map(([n, y]) => `<line x1="0" y1="${y}" x2="${CANVAS}" y2="${y}" stroke="#2980b9" stroke-width="1" stroke-dasharray="4 3"/><text x="4" y="${y - 3}" font-size="10" fill="#2980b9">${n} ${y}</text>`).join("\n")}
<circle cx="${L.centreX - L.eye.gap}" cy="${L.eye.y}" r="4" fill="none" stroke="#c0392b"/><circle cx="${L.centreX + L.eye.gap}" cy="${L.eye.y}" r="4" fill="none" stroke="#c0392b"/>
<path d="M${L.centreX - L.temple.halfWidth} ${L.temple.y} L${L.centreX - L.cheekbone.halfWidth} ${L.cheekbone.y} L${L.centreX - L.jawCorner.halfWidth} ${L.jawCorner.y} L${L.centreX} ${L.chin} L${L.centreX + L.jawCorner.halfWidth} ${L.jawCorner.y} L${L.centreX + L.cheekbone.halfWidth} ${L.cheekbone.y} L${L.centreX + L.temple.halfWidth} ${L.temple.y}" fill="none" stroke="#c0392b" stroke-width="1" stroke-dasharray="2 3"/>
<rect x="${L.centreX - L.neck.halfWidth}" y="${L.neck.top}" width="${L.neck.halfWidth * 2}" height="${L.collar - L.neck.top}" fill="none" stroke="#c0392b" stroke-width="1" stroke-dasharray="2 3"/>
<line x1="${L.centreX - 140}" y1="${L.ear.top}" x2="${L.centreX - 112}" y2="${L.ear.top}" stroke="#8e44ad"/><line x1="${L.centreX - 140}" y1="${L.ear.bottom}" x2="${L.centreX - 112}" y2="${L.ear.bottom}" stroke="#8e44ad"/>
<text x="${L.centreX + 6}" y="14" font-size="10" fill="#c0392b">centre ${L.centreX}</text>
</svg>`;

async function main() {
  mkdirSync("art/portrait/guides", { recursive: true });
  writeFileSync("art/portrait/guides/canvas-guide.svg", svg);
  await sharp(Buffer.from(svg)).png().toFile("art/portrait/guides/canvas-guide.png");
  await sharp(Buffer.from(svg), { density: 144 }).resize(1024, 1024).png().toFile("art/portrait/guides/canvas-guide@2x.png");
  console.log("wrote art/portrait/guides/canvas-guide.{svg,png,@2x.png}");
}
void main();
