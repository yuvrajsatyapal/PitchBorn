// Renders public/icon.svg to PNG app icons using Playwright's Chromium (dev-time only).
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/icon.svg", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [size, file, pad] of [[192, "icon-192.png", 0], [512, "icon-512.png", 0], [512, "icon-maskable-512.png", 60]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#fff5e6;display:grid;place-items:center;width:${size}px;height:${size}px"><div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div></body></html>`);
  await page.screenshot({ path: `public/${file}`, omitBackground: false });
}
await browser.close();
console.log("icons rendered");
