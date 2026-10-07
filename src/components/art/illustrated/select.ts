import { ageLook } from "@/engine/appearance/age";
import { LEGACY_TO_LIBRARY, agedHairstyle, hairstyleById, type Hairstyle } from "@/engine/appearance/hairstyles";
import {
  BROW_STYLES, DYED_HAIR_COLORS, EAR_STYLES, EYE_COLORS, EYE_SHAPES, FACE_SHAPES, FACIAL_HAIR, HAIR_COLORS, HAIR_COLOR_IDS, MARKS, MOUTH_STYLES,
  NOSE_STYLES, SCARS, SKIN_TONES, geoValue,
} from "@/engine/appearance/options";
import type { Appearance } from "@/engine/types";
import { backdropFor, luminance, mix } from "../shared";
import { LANDMARKS as L } from "./canvas";
import manifestJson from "./manifest.json";
import { FACE_FIT, slotByPath, slug, type Role, type Slot, type Tint } from "./slots";

/** Built asset files: "<slot>/<role>" -> [x, y, width, height] on the master canvas. */
export type Manifest = Record<string, readonly [number, number, number, number]>;
export const MANIFEST: Manifest = (manifestJson as { files: Manifest }).files;

export interface Pick {
  slot: Slot;
  colors: Partial<Record<Tint, string>>;
  /** SVG transform applied to the whole slot (fitting shared art to this head). */
  transform?: string;
  /** Mirror-pair features are split at the centre line: each half moves out by dx and turns by rotate degrees. */
  split?: { dx: number; rotate?: number; pivotY?: number; pivotGap?: number };
  /** Shading strength, tuned for skin tone. */
  shadow?: number;
  highlight?: number;
}

export interface Selection {
  picks: Pick[];
  hairstyle: Hairstyle;
  background: string;
  /** Transform for everything on the head (head width and height sliders). */
  head: string;
}

const about = (x: number, y: number, sx: number, sy: number) => `translate(${x} ${y}) scale(${sx} ${sy}) translate(${-x} ${-y})`;

/** The library hairstyle a stored appearance shows at this age (legacy index -> library id -> ageing path). */
export function hairstyleFor(a: Appearance, age: number): Hairstyle {
  const look = ageLook(a, age);
  const id = agedHairstyle(LEGACY_TO_LIBRARY[a.hair] ?? "shaved", look.recede);
  return hairstyleById(id) ?? hairstyleById("shaved")!;
}

export function selectArt(a: Appearance, age: number, kit: string, trim: string, background?: string, opts: { hairstyle?: string } = {}): Selection {
  const look = ageLook(a, age);
  const skin = SKIN_TONES[a.skin] ?? SKIN_TONES[0];
  const dark = 1 - luminance(skin);
  const hairstyle = (opts.hairstyle && hairstyleById(opts.hairstyle)) || hairstyleFor(a, age);
  const art = hairstyle.preset?.art ?? hairstyle.id;
  const dyed = (DYED_HAIR_COLORS as readonly number[]).includes(a.hairColor);
  const grey = (c: string, t: number) => (t > 0 ? mix(c, "#b8b8bb", t * 0.85) : c);
  const colorOf = (id: string | undefined) => (id ? HAIR_COLORS[(HAIR_COLOR_IDS as readonly string[]).indexOf(id)] : undefined);
  const hair = colorOf(hairstyle.preset?.color) ?? grey(HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0], dyed ? 0 : look.grey);
  const colors: Partial<Record<Tint, string>> = {
    skin,
    hair,
    hairSecondary: colorOf(hairstyle.preset?.secondary) ?? colorOf("platinum"),
    brow: mix(grey(HAIR_COLORS[a.browColor] ?? HAIR_COLORS[0], look.grey * 0.7), "#1d130d", 0.15),
    facial: grey(HAIR_COLORS[a.facialColor] ?? HAIR_COLORS[0], look.facialGrey),
    iris: EYE_COLORS[a.eyeColor] ?? EYE_COLORS[0],
    lip: mix(mix(skin, "#1d130d", 0.12), "#8e3f38", 0.32 - 0.12 * dark),
    kit,
    trim,
    accessory: "#f1ead8",
  };
  const face = slug(FACE_SHAPES[a.face]?.name ?? "Oval");
  const f = FACE_FIT[face] ?? FACE_FIT.oval;
  // Darker skin keeps its depth with lighter multiply shadows and stronger painted light.
  const skinShade = { shadow: 1 - 0.3 * dark, highlight: 0.55 + 0.45 * dark };
  const picks: Pick[] = [];
  const add = (path: string, p: Omit<Pick, "slot" | "colors"> = {}) => {
    const slot = slotByPath(path);
    if (slot) picks.push({ slot, colors, ...p });
  };

  const hairFit = about(L.centreX, L.crown, f.skullScale, 1);
  if (hairstyle.hasBackLayer) add(`hair/${art}/back`, { transform: hairFit });
  add("base/neck", skinShade);
  add("kits/v-neck");
  add(`ears/${slug(EAR_STYLES[a.ear] ?? "Medium")}`, { ...skinShade, split: { dx: f.earDx }, transform: about(L.centreX, (L.ear.top + L.ear.bottom) / 2, 1, geoValue("earScale", a.earSc)) });
  add(`faces/${face}`, skinShade);
  add(`eyes/${slug(EYE_SHAPES[a.eyes] ?? "Almond")}`, { split: { dx: L.eye.gap * (geoValue("eyeSpacing", a.eyeSp) - 1) } });
  add(`eyebrows/${slug(BROW_STYLES[a.brow] ?? "Straight")}`, { split: { dx: L.eye.gap * (geoValue("eyeSpacing", a.eyeSp) - 1), rotate: geoValue("eyebrowAngle", a.browAng), pivotY: L.brow, pivotGap: 22 } });
  add(`noses/${slug(NOSE_STYLES[a.nose] ?? "Straight")}`, { ...skinShade, transform: about(L.centreX, L.nose, geoValue("noseScale", a.noseSc), geoValue("noseScale", a.noseSc)) });
  add(`mouths/${slug(MOUTH_STYLES[a.mouth] ?? "Neutral")}`, skinShade);
  if (a.freckles) add("details/freckles");
  if (a.scar) add(`details/${slug(SCARS[a.scar])}`);
  if (a.mark) add(`details/${slug(MARKS[a.mark])}`);
  if (a.facial) add(`facialHair/${slug(FACIAL_HAIR[a.facial])}`, { transform: about(L.centreX, L.mouth, f.jawScale, 1 + f.chinDy / (L.chin - L.mouth)) });
  add(`hair/${art}/front`, { transform: hairFit });
  const accessory = a.accessory === 1 ? "sports-headband" : a.accessory === 2 ? "ear-stud" : hairstyle.defaultAccessory;
  if (accessory) add(`accessories/${accessory}`, accessory === "ear-stud" ? { split: { dx: f.earDx } } : { transform: hairFit });
  add("textures/paper");

  const head = about(L.centreX, L.eye.y, geoValue("headWidth", a.headW), geoValue("headHeight", a.headH));
  return { picks, hairstyle, background: background ?? backdropFor(a, kit), head };
}

export const fileKey = (slot: Slot, role: Role) => `${slot.path}/${role}`;

/** True when every required layer of every selected slot has been delivered. */
export function isRenderable(sel: Selection, manifest: Manifest = MANIFEST): boolean {
  return sel.picks.every((p) => p.slot.group === "texture" || p.slot.roles.every((r) => manifest[fileKey(p.slot, r)]));
}

/** Files this portrait still needs (for the QA sheet and the art checklist). */
export const missingFiles = (sel: Selection, manifest: Manifest = MANIFEST): string[] =>
  sel.picks.flatMap((p) => p.slot.roles.map((r) => fileKey(p.slot, r)).filter((k) => !manifest[k]));
