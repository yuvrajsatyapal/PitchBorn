/**
 * Builds the illustrated portrait assets.
 *
 *   npm run portraits:assets
 *
 * Reads art/portrait/source/<slot>/<role>.png (every file a full 512 x 512 transparent canvas drawn over the guide),
 * checks it, trims the empty space, writes public/portrait/<slot>/<role>.webp and records each file's position in
 * src/components/art/illustrated/manifest.json. Only delivered, checked files end up in the manifest, and a portrait
 * switches to illustrated art only when every layer it needs is there.
 */
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import sharp from "sharp";
import { CANVAS } from "../../src/components/art/illustrated/canvas";
import { SLOTS, type Role } from "../../src/components/art/illustrated/slots";

const MASK_ROLES: readonly Role[] = ["mask", "secondary-mask", "iris-mask", "lip-mask"];
/** Budget per hairstyle (front + back, all layers) and for the whole set, to keep the offline download sensible. */
export const BUDGET = { hairstyleKB: 140, totalMB: 12 };

export interface BuildResult {
  files: Record<string, [number, number, number, number]>;
  errors: string[];
  warnings: string[];
  bytes: Record<string, number>;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(png|webp)$/i.test(name)) out.push(p);
  }
  return out;
}

/** Bounding box of every pixel with any opacity, padded so soft edges survive. */
async function alphaBox(file: string): Promise<[number, number, number, number] | null> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width;
  let y0 = info.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 2) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const pad = 2;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(info.width - 1, x1 + pad);
  y1 = Math.min(info.height - 1, y1 + pad);
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

export async function buildAssets(source: string, out: string): Promise<BuildResult> {
  const res: BuildResult = { files: {}, errors: [], warnings: [], bytes: {} };
  const known = new Map(SLOTS.map((s) => [s.path, s]));
  for (const file of walk(source).sort()) {
    const rel = relative(source, file).split(sep).join("/");
    const role = rel.split("/").pop()!.replace(/\.(png|webp)$/i, "") as Role;
    const slotPath = rel.split("/").slice(0, -1).join("/");
    const slot = known.get(slotPath);
    if (!slot) {
      res.errors.push(`${rel}: unknown slot "${slotPath}" (see components/art/illustrated/slots.ts)`);
      continue;
    }
    if (![...slot.roles, ...(slot.optional ?? [])].includes(role)) {
      res.errors.push(`${rel}: "${role}" is not a layer of ${slotPath} (expected ${[...slot.roles, ...(slot.optional ?? [])].join(", ")})`);
      continue;
    }
    const meta = await sharp(file).metadata();
    if (meta.width !== CANVAS || meta.height !== CANVAS) {
      res.errors.push(`${rel}: must be drawn on the ${CANVAS}x${CANVAS} master canvas (got ${meta.width}x${meta.height})`);
      continue;
    }
    if (!meta.hasAlpha) {
      res.errors.push(`${rel}: needs a transparent background`);
      continue;
    }
    const box = await alphaBox(file);
    if (!box) {
      res.warnings.push(`${rel}: empty layer, skipped`);
      continue;
    }
    const isMask = MASK_ROLES.includes(role);
    let img = sharp(file).extract({ left: box[0], top: box[1], width: box[2], height: box[3] });
    if (isMask) {
      // Only the alpha of a mask matters; force it white so stray colour can't leak into the fill.
      const stats = await sharp(file).stats();
      const mean = stats.channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3;
      if (mean < 200) res.warnings.push(`${rel}: masks should be painted white (mean ${Math.round(mean)})`);
      const alpha = await img.clone().extractChannel(3).toBuffer();
      img = sharp({ create: { width: box[2], height: box[3], channels: 3, background: "#ffffff" } }).joinChannel(alpha);
    }
    const dest = join(out, `${slotPath}/${role}.webp`);
    mkdirSync(dirname(dest), { recursive: true });
    const buf = await img.webp(isMask ? { quality: 80, alphaQuality: 100, effort: 6 } : { quality: 88, alphaQuality: 95, effort: 6 }).toBuffer();
    writeFileSync(dest, buf);
    res.files[`${slotPath}/${role}`] = box;
    res.bytes[`${slotPath}/${role}`] = buf.length;
  }
  // Remove built files whose source is gone.
  for (const f of walk(out)) {
    const key = relative(out, f).split(sep).join("/").replace(/\.webp$/, "");
    if (!res.files[key]) rmSync(f);
  }
  // Budgets.
  const perHair = new Map<string, number>();
  for (const [k, b] of Object.entries(res.bytes)) if (k.startsWith("hair/")) perHair.set(k.split("/")[1], (perHair.get(k.split("/")[1]) ?? 0) + b);
  for (const [id, b] of perHair) if (b / 1024 > BUDGET.hairstyleKB) res.warnings.push(`hair/${id}: ${Math.round(b / 1024)}KB is over the ${BUDGET.hairstyleKB}KB budget`);
  const total = Object.values(res.bytes).reduce((a, b) => a + b, 0);
  if (total / 1048576 > BUDGET.totalMB) res.warnings.push(`total ${(total / 1048576).toFixed(1)}MB is over the ${BUDGET.totalMB}MB budget`);
  return res;
}

async function main() {
  const source = process.argv[2] ?? "art/portrait/source";
  const out = process.argv[3] ?? "public/portrait";
  const manifest = process.argv[4] ?? "src/components/art/illustrated/manifest.json";
  const res = await buildAssets(source, out);
  for (const w of res.warnings) console.warn("warn:", w);
  for (const e of res.errors) console.error("error:", e);
  if (res.errors.length) process.exit(1);
  const sorted = Object.fromEntries(Object.entries(res.files).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(manifest, `${JSON.stringify({ files: sorted }, null, 1)}\n`);
  const total = Object.values(res.bytes).reduce((a, b) => a + b, 0);
  console.log(`built ${Object.keys(sorted).length} layers, ${(total / 1024).toFixed(0)}KB -> ${out}, manifest ${manifest}`);
}

if (process.argv[1]?.endsWith("build-assets.ts")) void main();
