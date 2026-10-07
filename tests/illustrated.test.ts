import { existsSync, mkdirSync, mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildAssets } from "../scripts/portraits/build-assets";
import { PlayerPortrait } from "../src/components/art/PlayerPortrait";
import { IllustratedArt } from "../src/components/art/illustrated/IllustratedArt";
import { MANIFEST, fileKey, isRenderable, missingFiles, selectArt, type Manifest } from "../src/components/art/illustrated/select";
import { FACE_FIT, SLOTS, slotByPath } from "../src/components/art/illustrated/slots";
import { generateAppearance } from "../src/engine/appearance/generate";
import { HAIRSTYLES, LEGACY_TO_LIBRARY, POC_HAIRSTYLES, RARITY_SHARE, agedHairstyle, hairstyleById, hairstyleWeights, pickHairstyle, readyHairstyles } from "../src/engine/appearance/hairstyles";
import { DYED_HAIR_COLORS, FACE_SHAPES, HAIR_COLORS, HAIR_COLOR_IDS, HAIR_STYLES } from "../src/engine/appearance/options";
import { Rng } from "../src/engine/rng";

describe("hairstyle library", () => {
  it("holds the 100-style target library with unique ids and names", () => {
    expect(HAIRSTYLES.length).toBe(100);
    expect(new Set(HAIRSTYLES.map((h) => h.id)).size).toBe(100);
    expect(new Set(HAIRSTYLES.map((h) => h.name)).size).toBe(100);
  });

  it("never names a real player", () => {
    const real = /ronaldo|beckham|neymar|valderrama|gullit|rijkaard|pirlo|baggio|maldini|torres|ni(ñ|n)o|messi|zidane|ibrahimovic|pogba|balotelli|batistuta|gascoigne|seaman|hamsik|totti|cantona|lineker|ronaldinho/i;
    for (const h of HAIRSTYLES) expect(`${h.id} ${h.name} ${h.brief}`, h.id).not.toMatch(real);
  });

  it("marks the 12 proof-of-concept styles as prepared slots and nothing as ready before its art exists", () => {
    expect(POC_HAIRSTYLES.length).toBe(12);
    for (const id of POC_HAIRSTYLES) expect(hairstyleById(id)?.status).toBe("slot");
    expect(readyHairstyles()).toEqual([]);
  });

  it("presets reuse existing art instead of duplicating it for a colour", () => {
    for (const h of HAIRSTYLES.filter((x) => x.preset)) {
      const art = hairstyleById(h.preset!.art);
      expect(art, h.id).toBeTruthy();
      expect(art!.preset, h.id).toBeUndefined();
      for (const c of [h.preset!.color, h.preset!.secondary]) if (c) expect(HAIR_COLOR_IDS).toContain(c);
    }
  });

  it("maps every interim style to a library style", () => {
    expect(LEGACY_TO_LIBRARY.length).toBe(HAIR_STYLES.length);
    for (const id of LEGACY_TO_LIBRARY) expect(hairstyleById(id), id).toBeTruthy();
    for (const h of HAIRSTYLES) expect(h.legacy).toBeLessThan(HAIR_STYLES.length);
  });
});

describe("hairstyle generation", () => {
  const ctx = { darkness: 0.5, age: 25 };
  const share = (pool = HAIRSTYLES, c = ctx) => {
    const w = hairstyleWeights(pool, c);
    const out: Record<string, number> = {};
    pool.forEach((h, i) => (out[h.rarity] = (out[h.rarity] ?? 0) + w[i]));
    return out;
  };

  it("keeps each rarity tier at its configured share however many styles it holds", () => {
    const s = share();
    for (const r of Object.keys(RARITY_SHARE) as (keyof typeof RARITY_SHARE)[]) expect(s[r]).toBeCloseTo(RARITY_SHARE[r], 5);
  });

  it("is deterministic and keeps iconic looks special across a squad-sized sample", () => {
    const pick = (seed: string) => pickHairstyle(Rng.fromSeed(seed), HAIRSTYLES, ctx).id;
    for (let i = 0; i < 20; i++) expect(pick(`p${i}`)).toBe(pick(`p${i}`));
    const ids = Array.from({ length: 5000 }, (_, i) => pick(`squad-${i}`));
    const crescent = ids.filter((id) => id === "brazilian-crescent").length / ids.length;
    expect(crescent).toBeGreaterThan(0);
    expect(crescent).toBeLessThan(0.01);
    const iconic = ids.filter((id) => hairstyleById(id)!.rarity === "iconic").length / ids.length;
    expect(iconic).toBeGreaterThan(0.01);
    expect(iconic).toBeLessThan(0.035);
  });

  it("leans with age and skin tone without making anything impossible", () => {
    const ageing = (age: number) => HAIRSTYLES.reduce((s, h, i) => s + (h.category === "ageing" ? hairstyleWeights(HAIRSTYLES, { darkness: 0.5, age })[i] : 0), 0);
    expect(ageing(36)).toBeGreaterThan(ageing(19) * 4);
    const coily = (darkness: number) => HAIRSTYLES.reduce((s, h, i) => s + (h.texture === "coily" ? hairstyleWeights(HAIRSTYLES, { darkness, age: 25 })[i] : 0), 0);
    expect(coily(0.95)).toBeGreaterThan(coily(0.05) * 2);
    for (const w of hairstyleWeights(HAIRSTYLES, { darkness: 0, age: 18 })) expect(w).toBeGreaterThan(0);
  });

  it("only short conventional cuts follow the receding path, and only when the genes say so", () => {
    expect(agedHairstyle("textured-crop", 0)).toBe("textured-crop");
    expect(agedHairstyle("textured-crop", 0.6)).toBe("receding-temples");
    expect(agedHairstyle("textured-crop", 0.95)).toBe("balding-crown");
    expect(agedHairstyle("medium-dreads", 0.95)).toBe("medium-dreads");
    expect(agedHairstyle("lion-mane", 0.95)).toBe("lion-mane");
  });
});

describe("hair colours", () => {
  it("covers the natural palette plus rare dyes, with stable indexes", () => {
    expect(HAIR_COLORS.length).toBe(HAIR_COLOR_IDS.length);
    expect(HAIR_COLOR_IDS.slice(0, 10)).toEqual(["jet-black", "natural-black", "dark-brown", "medium-brown", "light-brown", "dirty-blonde", "blonde", "ginger", "auburn", "grey"]);
  });

  it("dyes are rare and never reach the brows or beard", () => {
    let dyed = 0;
    for (let i = 0; i < 3000; i++) {
      const a = generateAppearance(`dye-${i}`);
      if ((DYED_HAIR_COLORS as readonly number[]).includes(a.hairColor)) dyed++;
      expect(DYED_HAIR_COLORS).not.toContain(a.browColor);
      expect(DYED_HAIR_COLORS).not.toContain(a.facialColor);
    }
    expect(dyed / 3000).toBeGreaterThan(0.004);
    expect(dyed / 3000).toBeLessThan(0.03);
  });
});

describe("illustrated asset slots", () => {
  it("has a unique folder per slot and a fit for every face shape", () => {
    expect(new Set(SLOTS.map((s) => s.path)).size).toBe(SLOTS.length);
    for (const f of FACE_SHAPES) expect(FACE_FIT[f.name.toLowerCase().replace(/ /g, "-")], f.name).toBeTruthy();
  });

  it("prepares every proof-of-concept hairstyle, with back layers where the hair falls behind the head", () => {
    for (const id of POC_HAIRSTYLES) {
      const h = hairstyleById(id)!;
      expect(slotByPath(`hair/${id}/front`)?.poc, id).toBe(true);
      expect(!!slotByPath(`hair/${id}/back`), id).toBe(h.hasBackLayer);
    }
  });

  it("every built file in the manifest exists, and nothing is shipped without a manifest entry", () => {
    const files = new Set<string>();
    const walk = (d: string) => existsSync(d) && readdirSync(d).forEach((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : n.endsWith(".webp") && files.add(relative("public/portrait", join(d, n)).split(sep).join("/").replace(/\.webp$/, ""))));
    walk("public/portrait");
    expect([...files].sort()).toEqual(Object.keys(MANIFEST).sort());
  });
});

describe("illustrated selection and composition", () => {
  const a = { ...generateAppearance("ill"), face: 9, hair: 7, facial: 8, accessory: 1 };

  it("selects one slot per layer group with the player's colours", () => {
    const sel = selectArt(a, 25, "#c8102e", "#ffffff");
    const paths = sel.picks.map((p) => p.slot.path);
    expect(paths).toContain("faces/strong-jaw");
    expect(paths).toContain("hair/textured-crop/front");
    expect(paths).toContain("facialHair/short-beard");
    expect(paths).toContain("accessories/sports-headband");
    expect(sel.picks[0].colors.hair).toBe(HAIR_COLORS[a.hairColor]);
  });

  it("stays on the interim renderer until every needed layer is delivered", () => {
    const sel = selectArt(a, 25, "#c8102e", "#ffffff");
    expect(isRenderable(sel)).toBe(false);
    const full: Manifest = Object.fromEntries(missingFiles(sel).map((k) => [k, [0, 0, 512, 512] as const]));
    expect(isRenderable(sel, full)).toBe(true);
    // PlayerPortrait therefore still draws the vector stopgap today.
    expect(renderToStaticMarkup(createElement(PlayerPortrait, { appearance: a, age: 25, size: 120 }))).not.toContain("<image");
  });

  it("composes layers in order: colour masks, multiply shadow, screen highlight, ink; placeholders only in preview", () => {
    const sel = selectArt(a, 25, "#c8102e", "#ffffff");
    const hair = sel.picks.find((p) => p.slot.path === "hair/textured-crop/front")!;
    const manifest: Manifest = Object.fromEntries(hair.slot.roles.map((r) => [fileKey(hair.slot, r), [140, 20, 230, 200] as const]));
    const html = renderToStaticMarkup(createElement("svg", null, createElement(IllustratedArt, { sel, uid: "t", textured: false, manifest })));
    const at = (s: string) => html.indexOf(s);
    expect(at("hair/textured-crop/front/mask.webp")).toBeGreaterThan(-1);
    expect(html).toContain(`fill="${hair.colors.hair}" mask="url(#t`);
    expect(at("front/mask.webp")).toBeLessThan(at("front/shadow.webp"));
    expect(at("front/shadow.webp")).toBeLessThan(at("front/highlight.webp"));
    expect(at("front/highlight.webp")).toBeLessThan(at("front/ink.webp"));
    expect(html).toMatch(/shadow\.webp"[^>]*style="mix-blend-mode:multiply"/);
    expect(html).not.toContain("data-placeholder");
    const preview = renderToStaticMarkup(createElement("svg", null, createElement(IllustratedArt, { sel, uid: "p", textured: false, manifest, preview: true })));
    expect(preview).toContain('data-placeholder="faces/strong-jaw"');
    expect(preview).not.toContain('data-placeholder="hair/textured-crop/front"');
  });

  it("dyed hair keeps natural brows and the same face", () => {
    const natural = selectArt({ ...a, hairColor: 2, browColor: 2 }, 25, "#c8102e", "#fff");
    const dyed = selectArt({ ...a, hairColor: 10, browColor: 2 }, 25, "#c8102e", "#fff");
    expect(dyed.picks[0].colors.hair).not.toBe(natural.picks[0].colors.hair);
    expect(dyed.picks[0].colors.brow).toBe(natural.picks[0].colors.brow);
    expect(dyed.picks.map((p) => p.slot.path)).toEqual(natural.picks.map((p) => p.slot.path));
  });
});

describe("asset build", () => {
  const canvas = (svg: string, size = 512) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${svg}</svg>`)).png();

  it("trims each layer to its drawn area, records the offset and rejects files that break the canvas rules", async () => {
    const dir = mkdtempSync(join(tmpdir(), "assets-"));
    const src = join(dir, "src");
    mkdirSync(join(src, "hair/shaved/front"), { recursive: true });
    mkdirSync(join(src, "hair/not-a-style/front"), { recursive: true });
    mkdirSync(join(src, "noses/straight"), { recursive: true });
    await canvas(`<rect x="200" y="60" width="100" height="40" fill="#fff"/>`).toFile(join(src, "hair/shaved/front/mask.png"));
    await canvas(`<rect x="10" y="10" width="20" height="20" fill="#fff"/>`, 256).toFile(join(src, "noses/straight/ink.png"));
    await canvas(`<rect x="0" y="0" width="5" height="5" fill="#fff"/>`).toFile(join(src, "hair/not-a-style/front/mask.png"));
    const res = await buildAssets(src, join(dir, "out"));
    expect(res.files["hair/shaved/front/mask"]).toEqual([198, 58, 104, 44]);
    expect(existsSync(join(dir, "out/hair/shaved/front/mask.webp"))).toBe(true);
    expect(res.errors.some((e) => e.includes("512x512"))).toBe(true);
    expect(res.errors.some((e) => e.includes("unknown slot"))).toBe(true);
  });
});
