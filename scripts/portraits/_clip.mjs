import { chromium } from "playwright";
const [file, out, y, h] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
const p = await b.newPage({ viewport: { width: 1750, height: 900 } });
await p.goto("file://" + file);
await p.screenshot({ path: out, fullPage: true, clip: { x: 0, y: Number(y), width: 1750, height: Number(h) } });
await b.close();
