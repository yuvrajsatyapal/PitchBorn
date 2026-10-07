// node scripts/portraits/shoot.mjs <dir>  -> PNG per sheet
import { chromium } from "playwright";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
const dir = resolve(process.argv[2] ?? "portrait-sheets");
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const f of readdirSync(dir).filter((n) => n.endsWith(".html"))) {
  const p = await b.newPage({ viewport: { width: Number(process.env.W ?? 1500), height: 900 }, deviceScaleFactor: 1 });
  await p.goto(`file://${dir}/${f}`);
  await p.screenshot({ path: `${dir}/${f.replace(".html", ".png")}`, fullPage: true });
}
await b.close();
