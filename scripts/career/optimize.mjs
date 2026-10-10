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

await mkdir(OUT, { recursive: true });
const manifest = {};
for (const file of (await readdir(SRC)).filter((f) => /^pitchborn_.+\.png$/.test(f)).sort()) {
  const stage = file.replace(/^pitchborn_|\.png$/g, "");
  const img = sharp(path.join(SRC, file));
  const { width, height } = await img.metadata();
  const variants = { main: width, thumb: THUMB_WIDTH };
  for (const [kind, w] of Object.entries(variants)) {
    await img.clone().resize({ width: w }).avif({ quality: 58, effort: 6 }).toFile(path.join(OUT, `${stage}-${kind}.avif`));
    await img.clone().resize({ width: w }).webp({ quality: 80 }).toFile(path.join(OUT, `${stage}-${kind}.webp`));
  }
  manifest[stage] = { width, height, thumbWidth: THUMB_WIDTH, thumbHeight: Math.round((height * THUMB_WIDTH) / width) };
}
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(manifest);
