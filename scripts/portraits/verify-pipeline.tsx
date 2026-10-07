/**
 * End-to-end check of the raster pipeline with synthetic TEST PATTERNS (never shipped, never art):
 * build -> manifest -> compose in Chromium -> sample pixels. Proves masks take the chosen colour, multiply shading
 * and screen highlights keep their values over any colour, trimmed offsets line up, and ink sits on top.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/portraits/verify-pipeline.tsx
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";
import { buildAssets } from "./build-assets";
import { IllustratedArt } from "../../src/components/art/illustrated/IllustratedArt";
import { selectArt, type Manifest } from "../../src/components/art/illustrated/select";
import { generateAppearance } from "../../src/engine/appearance/generate";

const dir = mkdtempSync(join(tmpdir(), "portrait-pipeline-"));
const src = join(dir, "source");
const pub = join(dir, "portrait");
const layer = async (path: string, svg: string) => {
  mkdirSync(join(src, path, ".."), { recursive: true });
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${svg}</svg>`)).png().toFile(join(src, `${path}.png`));
};

async function main() {
  // Test pattern "hair": a box mask, a shadow band on its lower half, a highlight band on top, an ink frame.
  await layer("hair/textured-crop/front/mask", `<rect x="150" y="40" width="212" height="100" fill="#fff"/>`);
  await layer("hair/textured-crop/front/shadow", `<rect x="150" y="90" width="212" height="50" fill="#808080"/>`);
  await layer("hair/textured-crop/front/highlight", `<rect x="150" y="40" width="212" height="20" fill="#404040"/>`);
  await layer("hair/textured-crop/front/ink", `<rect x="150" y="40" width="212" height="100" fill="none" stroke="#000" stroke-width="4"/>`);
  const res = await buildAssets(src, pub);
  if (res.errors.length) throw new Error(res.errors.join("\n"));
  const manifest = res.files as Manifest;
  const box = manifest["hair/textured-crop/front/mask"];
  console.log("trimmed mask box", box);

  const a = { ...generateAppearance("pipe"), face: 9, headW: 50, headH: 50 };
  const render = (hairColor: number) => {
    const sel = selectArt({ ...a, hairColor }, 25, "#b5232f", "#f1ead8", "#ffffff", { hairstyle: "textured-crop" });
    // Only the hair slot, untransformed, so pixel positions are exact.
    sel.picks = sel.picks.filter((p) => p.slot.path === "hair/textured-crop/front").map((p) => ({ ...p, transform: undefined }));
    sel.head = "";
    return renderToStaticMarkup(createElement("svg", { width: 512, height: 512, viewBox: "0 0 512 512", xmlns: "http://www.w3.org/2000/svg" }, createElement(IllustratedArt, { sel, uid: `v${hairColor}`, textured: false, manifest, base: pub })));
  };
  writeFileSync(join(dir, "page.html"), `<body style="margin:0;background:#fff">${render(0)}${render(14)}</body>`);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1024, height: 512 } });
  await page.goto(`file://${join(dir, "page.html")}`);
  await page.waitForTimeout(300);
  const shot = await page.screenshot();
  await browser.close();
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3));
  const report = {
    // Jet black #16110d and red #b02a2a in the plain middle, the shadowed band, the highlight band; outside; ink.
    blackMid: px(256, 75), blackShadow: px(256, 115), blackHighlight: px(256, 50),
    redMid: px(512 + 256, 75), redShadow: px(512 + 256, 115), redHighlight: px(512 + 256, 50),
    outside: px(256, 300), ink: px(151, 90),
  };
  console.log(report);
  const near = (p: number[], q: number[], t = 12) => p.every((v, i) => Math.abs(v - q[i]) <= t);
  const checks = [
    ["mask takes the colour (black)", near(report.blackMid, [0x16, 0x11, 0x0d])],
    ["mask takes the colour (red)", near(report.redMid, [0xb0, 0x2a, 0x2a])],
    ["multiply shadow halves the colour", near(report.redShadow, [0x58, 0x15, 0x15], 14)],
    ["screen highlight lifts the colour", report.redHighlight[0] > report.redMid[0] && report.redHighlight[1] > report.redMid[1]],
    ["nothing outside the mask", near(report.outside, [255, 255, 255])],
    ["ink on top", near(report.ink, [0, 0, 0], 30)],
  ] as const;
  for (const [name, ok] of checks) console.log(ok ? "PASS" : "FAIL", name);
  if (checks.some(([, ok]) => !ok)) process.exit(1);
}
void main();
