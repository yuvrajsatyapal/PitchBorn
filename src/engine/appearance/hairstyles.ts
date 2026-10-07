/**
 * The illustrated hairstyle library.
 *
 * Every hairstyle is a set of hand-drawn raster layers (see docs/PORTRAIT_ART.md); this file only describes them:
 * what they are, how rare they are, which era they belong to and how they behave with colour, hairlines and age.
 * Styles inspired by football culture use descriptive fictional names. A hairstyle never carries facial identity.
 *
 * `status` tracks the art: "planned" (in the target library), "slot" (asset folder and brief prepared, art not yet
 * delivered) or "ready" (art delivered and checked). Only "ready" styles are ever shown to players or generated.
 */
import type { Rng } from "../rng";

export type HairCategory = "short" | "medium" | "long" | "curly" | "afro" | "braids" | "dreads" | "retro" | "modern" | "iconic" | "dyed" | "ageing";
export type HairTexture = "straight" | "wavy" | "curly" | "coily" | "braided" | "locked";
export type Rarity = "common" | "uncommon" | "rare" | "iconic";
export type Era = "70s" | "80s" | "90s" | "2000s" | "2010s" | "modern";
export type ArtStatus = "planned" | "slot" | "ready";
export type HairAccessory = "thin-headband" | "thick-headband" | "sports-headband" | "hair-tie";
export type Hairline = "low" | "normal" | "high" | "rounded" | "straight" | "widows-peak" | "uneven" | "mature" | "receding";

/** Colour ids in HAIR_COLOR_IDS order (options.ts). Cosmetic colours are rare in generation. */
export type HairColorId =
  | "jet-black" | "natural-black" | "dark-brown" | "medium-brown" | "light-brown" | "dirty-blonde" | "blonde" | "ginger" | "auburn" | "grey"
  | "platinum" | "white" | "silver" | "blue" | "red" | "pink";

export interface Hairstyle {
  id: string;
  /** Player-facing name. Never a real person's name. */
  name: string;
  category: HairCategory;
  texture: HairTexture;
  rarity: Rarity;
  era?: Era;
  /** Has a base mask so any hair colour can be applied while keeping the drawn shading. */
  supportsColor: boolean;
  /** Has a layer behind the head and neck (long hair, buns, ponytails, large afros). */
  hasBackLayer: boolean;
  /** Has a second recolourable region (frosted tips, bleached top, dyed ends). */
  hasSecondaryColor?: boolean;
  /** False when the style defines its own hairline (fringes, shaved patterns, curtains). */
  supportsExternalHairline: boolean;
  coversEars?: boolean;
  /** Accessory worn by default (a headband style still keeps the accessory as a separate layer). */
  defaultAccessory?: HairAccessory;
  /** Style + colour preset that reuses another style's art instead of new assets. */
  preset?: { art: string; color?: HairColorId; secondary?: HairColorId };
  /** Structure notes for the illustrator. Describes the cut, never a person. */
  brief: string;
  status: ArtStatus;
  /** Closest style in the interim vector renderer (index into HAIR_STYLES), used until this art is ready. */
  legacy: number;
}

const style = (
  id: string,
  name: string,
  category: HairCategory,
  texture: HairTexture,
  rarity: Rarity,
  legacy: number,
  brief: string,
  more: Partial<Omit<Hairstyle, "id" | "name" | "category" | "texture" | "rarity" | "legacy" | "brief">> = {},
): Hairstyle => ({ id, name, category, texture, rarity, legacy, brief, supportsColor: true, hasBackLayer: false, supportsExternalHairline: true, status: "planned", ...more });

/** The twelve proof-of-concept styles: deliberately different hair structures, prepared first as asset slots. */
export const POC_HAIRSTYLES = [
  "shaved", "textured-crop", "curly-fade", "medium-afro", "classic-cornrows", "medium-dreads",
  "classic-curtains", "frosted-faux-hawk", "brazilian-crescent", "classic-mullet", "long-headband", "lion-mane",
] as const;

export const HAIRSTYLES: readonly Hairstyle[] = [
  // ---------------------------------------------------------------- A. iconic football-inspired
  style("brazilian-crescent", "Brazilian Crescent", "iconic", "straight", "iconic", 0, "Head shaved close all over; a single small crescent-shaped patch of short hair left at the front-centre above the forehead. The patch is the whole silhouette: keep it crisp and readable at 48px.", { era: "2000s", supportsExternalHairline: false }),
  style("frosted-faux-hawk", "Frosted Faux Hawk", "iconic", "straight", "rare", 28, "Short faded sides; a raised, textured central ridge pushed up and slightly forward with separate gelled clumps. Tips are a second colour (frosted).", { era: "2000s", hasSecondaryColor: true }),
  style("classic-curtains", "Classic Curtains", "retro", "straight", "uncommon", 24, "Medium straight hair with a centre part; two curtain sections fall from the part towards each temple and over the ears, strand groups clearly drawn.", { era: "90s", supportsExternalHairline: false, coversEars: true }),
  style("long-headband", "Long Headband", "iconic", "wavy", "rare", 23, "Shoulder-length, slightly wavy hair held off the face by a headband; loose organic strands fall at the sides and behind the shoulders. Headband is a separate accessory layer.", { era: "90s", hasBackLayer: true, coversEars: true, defaultAccessory: "sports-headband" }),
  style("playmaker-waves", "Playmaker Waves", "medium", "wavy", "uncommon", 22, "Medium-length hair with soft natural waves, loose side or centre part, flowing back off the face.", { era: "2000s", hasBackLayer: true }),
  style("roman-curtains", "Roman Curtains", "retro", "straight", "rare", 24, "Medium-long hair with a strong centre part and heavy curtain sections, a little messy at the ends.", { era: "90s", supportsExternalHairline: false, coversEars: true, hasBackLayer: true }),
  style("milan-flow", "Milan Flow", "long", "wavy", "rare", 23, "Medium to long straight-wavy hair swept back, flowing at the sides and nape with natural movement.", { era: "90s", hasBackLayer: true, coversEars: true }),
  style("swept-maestro", "Swept Maestro", "medium", "straight", "uncommon", 26, "Medium length swept straight back with a few loose strands falling forward; works with a mature hairline.", { era: "2000s" }),
  style("golden-ponytail", "Golden Ponytail", "long", "straight", "rare", 34, "Long hair pulled back and tied behind the head; a couple of side strands left loose at the temples.", { hasBackLayer: true, defaultAccessory: "hair-tie" }),
  style("samurai-bun", "Samurai Bun", "modern", "straight", "rare", 33, "Short or shaved sides, long top gathered into a compact bun on the crown.", { era: "2010s", hasBackLayer: true, defaultAccessory: "hair-tie" }),
  style("top-knot-fade", "Top Knot Fade", "modern", "straight", "uncommon", 33, "Faded sides, longer top tied into a small knot towards the back of the crown.", { era: "2010s", hasBackLayer: true }),
  style("sharp-mohawk", "Sharp Mohawk", "iconic", "straight", "rare", 28, "Sides shaved to skin; a narrow, tall central strip with irregular textured tips.", { supportsExternalHairline: false }),
  style("wide-mohawk", "Wide Mohawk", "iconic", "straight", "rare", 37, "Wider central strip over faded sides, textured silhouette.", { supportsExternalHairline: false }),
  style("bleached-mohawk", "Bleached Mohawk", "iconic", "straight", "iconic", 28, "Sharp Mohawk art in platinum, darker roots optional through the secondary region.", { preset: { art: "sharp-mohawk", color: "platinum" }, supportsExternalHairline: false }),
  style("brazilian-mohawk", "Brazilian Mohawk", "iconic", "curly", "rare", 28, "Short sides, messy textured curly centre; top optionally dyed via the secondary region.", { era: "2010s", hasSecondaryColor: true, supportsExternalHairline: false }),
  style("spiky-fringe", "Spiky Fringe", "short", "straight", "uncommon", 36, "Gelled short hair pushed forward and up into individual irregular spikes.", { era: "2000s" }),
  style("frosted-spikes", "Frosted Spikes", "dyed", "straight", "rare", 36, "Spiky Fringe art with dark roots and lighter tips.", { era: "2000s", preset: { art: "spiky-fringe", secondary: "platinum" } }),
  style("strikers-fringe", "Striker's Fringe", "medium", "straight", "rare", 22, "Medium straight hair with a long fringe falling across the forehead and flowing sides.", { era: "2000s", supportsExternalHairline: false, coversEars: true }),
  style("lion-mane", "Lion Mane", "iconic", "curly", "iconic", 11, "Enormous curly mane: very high volume, dense individual curls, wide irregular silhouette that frames the face and spills past the shoulders.", { era: "90s", hasBackLayer: true, coversEars: true }),
  style("dutch-dreads", "Dutch Dreads", "iconic", "locked", "iconic", 17, "Long thick dreadlocks with a strong silhouette; every lock drawn individually, some falling forward over the shoulders.", { era: "80s", hasBackLayer: true, coversEars: true }),

  // ---------------------------------------------------------------- B. afro / coily
  style("short-afro", "Short Afro", "afro", "coily", "common", 9, "Short, even afro following the skull; irregular edge made of small coils, natural hairline.", {}),
  style("medium-afro", "Medium Afro", "afro", "coily", "common", 10, "Medium rounded afro with an irregular, cloud-like silhouette built from curl clusters; density varies, lit clusters on the light side.", { hasBackLayer: true, coversEars: true }),
  style("big-afro", "Big Afro", "afro", "coily", "uncommon", 11, "Large afro well beyond the head, irregular silhouette, visible curl clusters, darker mass towards the back.", { era: "70s", hasBackLayer: true, coversEars: true }),
  style("rounded-afro", "Rounded Afro", "afro", "coily", "uncommon", 10, "Neatly shaped round afro with a soft but still irregular edge.", { era: "70s", hasBackLayer: true, coversEars: true }),
  style("high-top-afro", "High-Top Afro", "afro", "coily", "rare", 9, "Tall flat-topped afro over tight faded sides.", { era: "90s", supportsExternalHairline: false }),
  style("afro-fade", "Afro Fade", "afro", "coily", "common", 9, "Short afro top over a fade; coil texture thins into the faded sides.", {}),
  style("curly-afro-fade", "Curly Afro Fade", "afro", "curly", "common", 8, "Defined curls on top over a skin or low fade.", { era: "modern" }),
  style("natural-coils", "Natural Coils", "afro", "coily", "common", 13, "Short natural coils standing slightly off the scalp.", {}),
  style("high-coils", "High Coils", "afro", "coily", "uncommon", 13, "Taller coils on top, shorter at the sides.", { era: "modern" }),
  style("coily-taper", "Coily Taper", "afro", "coily", "common", 9, "Short coils tapered neatly at the temples and nape.", {}),

  // ---------------------------------------------------------------- C. braids / cornrows / dreadlocks / twists
  style("classic-cornrows", "Classic Cornrows", "braids", "braided", "uncommon", 14, "Cornrows running from the hairline straight back over the crown; each row is an individually drawn braid with scalp visible between rows.", { supportsExternalHairline: false }),
  style("straight-back-cornrows", "Straight-Back Cornrows", "braids", "braided", "uncommon", 14, "Fewer, thicker cornrows straight back, ends hanging at the nape.", { hasBackLayer: true, supportsExternalHairline: false }),
  style("pattern-cornrows", "Pattern Cornrows", "braids", "braided", "rare", 14, "Cornrows in curved or zig-zag patterns.", { supportsExternalHairline: false }),
  style("short-braids", "Short Braids", "braids", "braided", "uncommon", 16, "Short individual braids falling just past the ears.", { coversEars: true }),
  style("medium-braids", "Medium Braids", "braids", "braided", "uncommon", 15, "Individual braids to the jaw or collar.", { hasBackLayer: true, coversEars: true }),
  style("long-braids", "Long Braids", "braids", "braided", "rare", 15, "Long individual braids past the shoulders.", { hasBackLayer: true, coversEars: true }),
  style("box-braids", "Box Braids", "braids", "braided", "uncommon", 15, "Box braids with visible square partings at the scalp.", { hasBackLayer: true, coversEars: true, supportsExternalHairline: false }),
  style("braided-ponytail", "Braided Ponytail", "braids", "braided", "rare", 34, "Braids gathered into a ponytail behind the head.", { hasBackLayer: true, defaultAccessory: "hair-tie" }),
  style("short-dreads", "Short Dreads", "dreads", "locked", "uncommon", 18, "Short dreadlocks standing up and out, each lock drawn.", {}),
  style("medium-dreads", "Medium Dreads", "dreads", "locked", "uncommon", 17, "Dreadlocks to the jaw or collar; each lock individually drawn with its own width, twist texture and highlight, some falling forward, the rest behind the head.", { hasBackLayer: true, coversEars: true }),
  style("long-dreads", "Long Dreads", "dreads", "locked", "rare", 17, "Long dreadlocks past the shoulders.", { hasBackLayer: true, coversEars: true }),
  style("tied-dreads", "Tied Dreads", "dreads", "locked", "rare", 33, "Dreadlocks tied up on top of the head.", { hasBackLayer: true, defaultAccessory: "hair-tie" }),
  style("dread-fade", "Dread Fade", "dreads", "locked", "uncommon", 18, "Short dreadlocks on top over faded sides.", { era: "modern" }),
  style("short-twists", "Short Twists", "dreads", "coily", "common", 13, "Short two-strand twists across the top.", {}),
  style("twist-fade", "Twist Fade", "dreads", "coily", "common", 13, "Twists on top over a fade.", { era: "modern" }),
  style("freeform-twists", "Freeform Twists", "dreads", "coily", "uncommon", 13, "Irregular freeform twists of different lengths.", {}),

  // ---------------------------------------------------------------- D. retro
  style("classic-mullet", "Classic Mullet", "retro", "wavy", "uncommon", 29, "Short on top and sides with a feathered fringe; long, slightly wavy hair at the back falling onto the neck and shoulders.", { era: "80s", hasBackLayer: true }),
  style("curly-mullet", "Curly Mullet", "retro", "curly", "rare", 29, "Mullet in tight curls, volume at the back.", { era: "80s", hasBackLayer: true }),
  style("retro-side-part", "Retro Side Part", "retro", "straight", "common", 25, "Neat side part, combed flat, short back and sides.", { era: "70s" }),
  style("classic-slickback", "Classic Slickback", "retro", "straight", "common", 26, "Combed straight back with a wet sheen, short sides.", { era: "90s" }),
  style("long-slickback", "Long Slickback", "retro", "straight", "uncommon", 26, "Longer hair slicked back to the collar.", { era: "90s", hasBackLayer: true }),
  style("seventies-waves", "70s Waves", "retro", "wavy", "uncommon", 22, "Collar-length wavy hair with full sides covering the ears.", { era: "70s", hasBackLayer: true, coversEars: true }),
  style("eighties-volume", "80s Volume", "retro", "curly", "uncommon", 20, "Big permed volume on top and sides.", { era: "80s", hasBackLayer: true, coversEars: true }),
  style("nineties-curtains", "90s Curtains", "retro", "straight", "uncommon", 24, "Shorter curtains: centre part, sides falling to the temples.", { era: "90s", supportsExternalHairline: false }),
  style("floppy-fringe", "Floppy Fringe", "retro", "straight", "uncommon", 38, "Heavy floppy fringe falling over one brow.", { era: "90s", supportsExternalHairline: false }),
  style("long-center-part", "Long Centre Part", "retro", "straight", "uncommon", 23, "Long straight hair with a centre part past the jaw.", { era: "90s", hasBackLayer: true, coversEars: true, supportsExternalHairline: false }),
  style("shoulder-flow", "Shoulder-Length Flow", "long", "wavy", "uncommon", 23, "Shoulder-length hair with natural movement.", { hasBackLayer: true, coversEars: true }),
  style("wet-look", "Wet Look", "retro", "straight", "uncommon", 26, "Short gelled wet-look hair combed back and up.", { era: "90s" }),
  style("classic-quiff", "Classic Quiff", "retro", "straight", "uncommon", 28, "Rounded quiff lifted at the front, neat sides.", { era: "70s" }),

  // ---------------------------------------------------------------- E. modern
  style("textured-crop", "Textured Crop", "modern", "straight", "common", 7, "Short crop with a choppy textured top pushed forward into a short irregular fringe; tapered sides with visible density change.", { era: "modern", supportsExternalHairline: false }),
  style("french-crop", "French Crop", "modern", "straight", "common", 2, "Short top with a straight blunt fringe, faded sides.", { era: "modern", supportsExternalHairline: false }),
  style("caesar-crop", "Caesar Crop", "modern", "straight", "common", 35, "Very short even crop with a short straight fringe.", { supportsExternalHairline: false }),
  style("messy-crop", "Messy Crop", "modern", "wavy", "common", 27, "Messy textured top falling in different directions.", { era: "modern" }),
  style("low-fade", "Low Fade", "modern", "straight", "common", 3, "Short top, fade starting just above the ears.", { era: "modern" }),
  style("mid-fade", "Mid Fade", "modern", "straight", "common", 4, "Short top swept to the side, fade from the temples.", { era: "modern" }),
  style("high-fade", "High Fade", "modern", "straight", "common", 5, "Short top, fade rising high up the sides.", { era: "modern" }),
  style("skin-fade", "Skin Fade", "modern", "straight", "common", 5, "Fade down to bare skin with a textured top.", { era: "modern" }),
  style("drop-fade", "Drop Fade", "modern", "straight", "uncommon", 4, "Fade that drops behind the ear.", { era: "modern" }),
  style("burst-fade", "Burst Fade", "modern", "curly", "uncommon", 8, "Fade bursting around the ear, curls or coils on top.", { era: "modern" }),
  style("taper-fade", "Taper Fade", "modern", "straight", "common", 6, "Gentle taper at the temples and nape, medium-short top.", { era: "modern" }),
  style("curly-fade", "Curly Fade", "modern", "curly", "common", 8, "Defined loose curls piled on top, each curl drawn as its own ringlet or clump; tight fade on the sides with a natural density transition.", { era: "modern" }),
  style("buzz-fade", "Buzz Fade", "modern", "straight", "common", 1, "Buzzed top over a fade.", { era: "modern" }),
  style("sharp-undercut", "Sharp Undercut", "modern", "straight", "uncommon", 37, "Disconnected undercut: long top over shaved sides.", { era: "2010s" }),
  style("slick-undercut", "Slick Undercut", "modern", "straight", "uncommon", 37, "Undercut with the top slicked back.", { era: "2010s" }),
  style("messy-quiff", "Messy Quiff", "modern", "wavy", "uncommon", 28, "Loose, messy quiff.", { era: "modern" }),
  style("sculpted-quiff", "Sculpted Quiff", "modern", "straight", "uncommon", 28, "Tall sculpted quiff, tight sides.", { era: "2010s" }),
  style("modern-side-part", "Modern Side Part", "modern", "straight", "common", 25, "Side part with a hard part line and faded sides.", { era: "modern" }),
  style("short-waves", "Short Waves", "modern", "wavy", "common", 12, "360 waves brushed close to the scalp.", { era: "modern" }),
  style("curly-top", "Curly Top", "modern", "curly", "common", 19, "Medium curls on top with short sides.", { era: "modern" }),
  style("textured-fringe", "Textured Fringe", "modern", "straight", "common", 21, "Textured fringe falling forward.", { era: "modern", supportsExternalHairline: false }),

  // ---------------------------------------------------------------- F. dyed / expressive (presets reuse other art)
  style("bleached-buzz", "Bleached Buzz", "dyed", "straight", "rare", 1, "Very Short Buzz art in platinum.", { preset: { art: "very-short-buzz", color: "platinum" } }),
  style("platinum-crop", "Platinum Crop", "dyed", "straight", "rare", 7, "Textured Crop art in platinum.", { preset: { art: "textured-crop", color: "platinum" }, supportsExternalHairline: false }),
  style("platinum-curls", "Platinum Curls", "dyed", "curly", "rare", 19, "Curly Top art in platinum.", { preset: { art: "curly-top", color: "platinum" } }),
  style("dyed-tips", "Dyed Tips", "dyed", "straight", "rare", 36, "Spiky Fringe art with cosmetic tips through the secondary region.", { preset: { art: "spiky-fringe", secondary: "red" } }),
  style("frosted-tips", "Frosted Tips", "dyed", "straight", "rare", 7, "Textured Crop art with platinum tips through the secondary region.", { era: "2000s", preset: { art: "textured-crop", secondary: "platinum" } }),
  style("two-tone-crop", "Two-Tone Crop", "dyed", "straight", "rare", 7, "Textured Crop with a contrasting top through the secondary region.", { preset: { art: "textured-crop", secondary: "blonde" } }),
  style("blonde-top", "Blonde Top, Dark Sides", "dyed", "straight", "rare", 5, "High Fade art with a blonde top through the secondary region.", { preset: { art: "high-fade", secondary: "blonde" } }),
  style("dyed-mohawk", "Dyed Mohawk", "dyed", "straight", "rare", 28, "Sharp Mohawk art in a cosmetic colour.", { preset: { art: "sharp-mohawk", color: "blue" }, supportsExternalHairline: false }),
  style("dyed-dreads", "Dyed Dreads", "dyed", "locked", "rare", 17, "Medium Dreads art with dyed ends through the secondary region.", { preset: { art: "medium-dreads", secondary: "blonde" }, hasBackLayer: true, coversEars: true }),
  style("dyed-braids", "Dyed Braids", "dyed", "braided", "rare", 15, "Medium Braids art in a cosmetic colour.", { preset: { art: "medium-braids", color: "red" }, hasBackLayer: true, coversEars: true }),

  // ---------------------------------------------------------------- G. shaved / bald / ageing
  style("clean-bald", "Clean Bald", "ageing", "straight", "common", 0, "No hair: a clean bald scalp with a soft sheen on the crown.", { supportsColor: false, supportsExternalHairline: false }),
  style("shaved", "Shaved", "short", "straight", "common", 0, "Head shaved to stubble: hair shows only as a fine stippled density on the scalp following a natural hairline, darker at the temples and sides. No silhouette above the skull.", { supportsExternalHairline: false }),
  style("very-short-buzz", "Very Short Buzz", "short", "straight", "common", 1, "Even buzz cut, short stippled texture, a hint of thickness at the outline.", {}),
  style("mature-hairline", "Mature Hairline", "ageing", "straight", "common", 30, "Short cut with the temples slightly receded.", {}),
  style("receding-temples", "Receding Temples", "ageing", "straight", "common", 30, "Clear M-shaped recession at the temples.", { supportsExternalHairline: false }),
  style("deep-recession", "Deep Recession", "ageing", "straight", "common", 30, "Deep temple recession leaving a forelock island.", { supportsExternalHairline: false }),
  style("sides-only", "Sides Only", "ageing", "straight", "common", 32, "Bald top, hair only on the sides and back.", { supportsExternalHairline: false }),
  style("thinning-top", "Thinning Top", "ageing", "straight", "common", 31, "Short hair with scalp visible through the top.", {}),
  style("thinning-crown", "Thinning Crown", "ageing", "straight", "common", 31, "Thinning at the crown, front intact.", {}),
  style("balding-crown", "Balding Crown", "ageing", "straight", "common", 31, "Bald crown with a thin front.", { supportsExternalHairline: false }),
].map((h): Hairstyle => (POC_HAIRSTYLES.includes(h.id as (typeof POC_HAIRSTYLES)[number]) ? { ...h, status: "slot" } : h));

export const hairstyleById = (id: string): Hairstyle | undefined => HAIRSTYLES.find((h) => h.id === id);

// ---------------------------------------------------------------- generation

/** Share of generated players per rarity tier; split across the eligible styles of each tier. Configurable. */
export const RARITY_SHARE: Record<Rarity, number> = { common: 0.7, uncommon: 0.2, rare: 0.08, iconic: 0.02 };

export interface HairPickContext {
  /** 0 (lightest) to 1 (darkest) skin. */
  darkness: number;
  age: number;
  /** World era; leave out for a modern world. */
  era?: Era;
}

const ERA_ORDER: Era[] = ["70s", "80s", "90s", "2000s", "2010s", "modern"];

/** Probability influences, never hard rules: any style can appear on anyone. */
export function hairstyleFactor(h: Hairstyle, ctx: HairPickContext): number {
  const d = ctx.darkness;
  let f = 1;
  // Texture leans with skin tone, as the old generator did.
  if (h.texture === "coily" || h.texture === "locked" || h.texture === "braided") f *= 0.35 + 1.4 * d;
  else if (h.texture === "curly") f *= 0.8 + 0.5 * d;
  else if (h.texture === "straight") f *= 1.3 - 0.75 * d;
  // Age: young players experiment, older players get conservative and thinner.
  const young = Math.max(0, Math.min(1, (24 - ctx.age) / 6));
  const old = Math.max(0, Math.min(1, (ctx.age - 29) / 8));
  if (h.category === "dyed" || h.category === "iconic") f *= 1 + 0.8 * young - 0.5 * old;
  if (h.category === "ageing") f *= h.id === "shaved" || h.id === "clean-bald" ? 0.6 + old : 0.03 + 1.6 * old;
  if (h.category === "retro") f *= 1 + 0.3 * old;
  // Era: styles from the world's era are favoured, distant eras fade out.
  if (h.era) {
    const now = ERA_ORDER.indexOf(ctx.era ?? "modern");
    const gap = Math.abs(ERA_ORDER.indexOf(h.era) - now);
    f *= [1.6, 1, 0.55, 0.35, 0.25, 0.2][gap];
  }
  return Math.max(0, f);
}

/** Selection weights over `pool`: each rarity tier keeps its share however many styles it holds. */
export function hairstyleWeights(pool: readonly Hairstyle[], ctx: HairPickContext): number[] {
  const raw = pool.map((h) => hairstyleFactor(h, ctx));
  const tierTotal: Partial<Record<Rarity, number>> = {};
  pool.forEach((h, i) => (tierTotal[h.rarity] = (tierTotal[h.rarity] ?? 0) + raw[i]));
  const present = (Object.keys(tierTotal) as Rarity[]).reduce((s, r) => s + RARITY_SHARE[r], 0) || 1;
  return pool.map((h, i) => (raw[i] > 0 ? (RARITY_SHARE[h.rarity] / present) * (raw[i] / (tierTotal[h.rarity] || 1)) : 0));
}

/** Deterministic: the same rng state always gives the same style. */
export function pickHairstyle(rng: Rng, pool: readonly Hairstyle[], ctx: HairPickContext): Hairstyle {
  const w = hairstyleWeights(pool, ctx);
  const total = w.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Styles players can see and NPCs can get: only those whose art has been delivered. */
export const readyHairstyles = (): Hairstyle[] => HAIRSTYLES.filter((h) => h.status === "ready");

// ---------------------------------------------------------------- legacy mapping and ageing

/** Interim vector style index -> library id, for saves when the illustrated renderer takes over. */
export const LEGACY_TO_LIBRARY: readonly string[] = [
  "shaved", "very-short-buzz", "french-crop", "low-fade", "mid-fade", "high-fade", "taper-fade", "textured-crop", "curly-fade", "short-afro",
  "medium-afro", "big-afro", "short-waves", "short-twists", "classic-cornrows", "medium-braids", "short-braids", "long-dreads", "short-dreads", "curly-top",
  "eighties-volume", "textured-fringe", "floppy-fringe", "long-center-part", "classic-curtains", "modern-side-part", "classic-slickback", "messy-crop", "sculpted-quiff", "classic-mullet",
  "receding-temples", "thinning-top", "sides-only", "samurai-bun", "golden-ponytail", "caesar-crop", "spiky-fringe", "sharp-undercut", "floppy-fringe",
];

/**
 * Hairline retreat with age. Only short, conventional cuts move along the path (full -> mature -> receding ->
 * thinning -> balding); long, braided, locked and iconic styles keep their art. Never forced: `recede` is 0 for
 * players whose genes don't recede.
 */
export function agedHairstyle(id: string, recede: number): string {
  const h = hairstyleById(id);
  if (!h || recede < 0.25) return id;
  const short = h.category === "short" || h.category === "modern" || (h.category === "retro" && !h.hasBackLayer);
  if (!short || h.texture === "braided" || h.texture === "locked") return id;
  if (recede < 0.5) return "mature-hairline";
  if (recede < 0.7) return "receding-temples";
  if (recede < 0.85) return "thinning-top";
  return "balding-crown";
}
