// Turns the source illustrations in art/career/pitchborn_<stage>.png into AVIF + WebP files in public/images/career/:
// a full-size "main" version (never upscaled) and a small thumbnail, plus the manifest the landing page imports.
// Usage: npm run career:assets
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "art/career";
const OUT = "public/images/career";
const MANIFEST = "src/components/landing/career-assets.json";
const THUMB_WIDTH = 240;
// The generated art ships with a few pixels of white/black matte on its edges; crop it off so it never shows in the frame.
const EDGE_CROP = 8;

await mkdir(OUT, { recursive: true });
const manifest = {};
for (const file of (await readdir(SRC)).filter((f) => /^pitchborn_.+\.png$/.test(f)).sort()) {
  const stage = file.replace(/^pitchborn_|\.png$/g, "");
  const full = sharp(path.join(SRC, file));
  const meta = await full.metadata();
  const width = meta.width - EDGE_CROP * 2;
  const height = meta.height - EDGE_CROP * 2;
  const img = sharp(await full.extract({ left: EDGE_CROP, top: EDGE_CROP, width, height }).toBuffer());
  const variants = { main: width, thumb: THUMB_WIDTH };
  for (const [kind, w] of Object.entries(variants)) {
    await img.clone().resize({ width: w }).avif({ quality: 58, effort: 6 }).toFile(path.join(OUT, `${stage}-${kind}.avif`));
    await img.clone().resize({ width: w }).webp({ quality: 80 }).toFile(path.join(OUT, `${stage}-${kind}.webp`));
  }
  manifest[stage] = { width, height, thumbWidth: THUMB_WIDTH, thumbHeight: Math.round((height * THUMB_WIDTH) / width) };
}
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(manifest);
