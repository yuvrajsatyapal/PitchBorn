"use client";
import { useState, type ReactNode } from "react";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { Button, Tabs } from "@/components/ui";
import { randomizeAppearance, supportsHairTips, type RandomScope } from "@/engine/appearance/generate";
import {
  ACCESSORIES, BAND_COLORS, BAND_COLOR_NAMES, BROW_STYLES, HAIR_TIP_COLORS, HAIR_TIP_NAMES, COUNTS, EAR_STYLES, EYE_COLORS, EYE_COLOR_NAMES, EYE_SHAPES, FACE_SHAPES, FACIAL_HAIR, HAIR_COLORS, HAIR_COLOR_NAMES, HAIR_STYLES, MARKS,
  MOUTH_STYLES, NOSE_STYLES, SCARS, SKIN_NAMES, SKIN_TONES, type AppearanceKey,
} from "@/engine/appearance/options";
import { Rng } from "@/engine/rng";
import type { Appearance } from "@/engine/types";

type Cat = "face" | "skin" | "hair" | "hairColor" | "eyes" | "brows" | "nose" | "mouth" | "facial" | "details";
const CATS: { id: Cat; label: string }[] = [
  { id: "face", label: "Face" },
  { id: "skin", label: "Skin" },
  { id: "hair", label: "Hair" },
  { id: "hairColor", label: "Hair colour" },
  { id: "eyes", label: "Eyes" },
  { id: "brows", label: "Eyebrows" },
  { id: "nose", label: "Nose" },
  { id: "mouth", label: "Mouth" },
  { id: "facial", label: "Facial hair" },
  { id: "details", label: "Details" },
];

const PREVIEW_AGES = [
  { id: "18", label: "18" },
  { id: "26", label: "26" },
  { id: "34", label: "34" },
  { id: "40", label: "40" },
];

function Stepper({ label, value, names, onChange }: { label: string; value: number; names: readonly string[]; onChange: (v: number) => void }) {
  const n = names.length;
  return (
    <div className="flex items-center justify-between gap-2 text-sm font-bold">
      <span className="shrink-0">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <button type="button" className="h-9 w-9 shrink-0 rounded-full border-2 border-line bg-card" aria-label={`Previous ${label}`} onClick={() => onChange((value + n - 1) % n)}>
          ‹
        </button>
        <span className="w-32 truncate text-center font-semibold tabular-nums sm:w-40">{names[value]}</span>
        <button type="button" className="h-9 w-9 shrink-0 rounded-full border-2 border-line bg-card" aria-label={`Next ${label}`} onClick={() => onChange((value + 1) % n)}>
          ›
        </button>
      </span>
    </div>
  );
}

function Swatches({ label, value, colors, names, onChange }: { label: string; value: number; colors: readonly string[]; names: readonly string[]; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm font-bold">
        <span>{label}</span>
        <span className="text-xs font-semibold text-muted">{names[value]}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c, i) => (
          <button
            key={c}
            type="button"
            aria-label={names[i]}
            aria-pressed={value === i}
            onClick={() => onChange(i)}
            style={{ background: c }}
            className={`h-8 w-8 rounded-full border-2 ${value === i ? "border-ink ring-2 ring-sun" : "border-line"}`}
          />
        ))}
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="grid gap-0.5 text-xs font-bold text-ink-2">
      {label}
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--pitch)]" />
    </label>
  );
}

/** Character creator "Look" panel: big portrait on top, category tabs, one panel of options at a time. */
export function AppearanceEditor({ value, onChange, kit, previewAge = 19 }: { value: Appearance; onChange: (a: Appearance) => void; kit?: string; previewAge?: number }) {
  const [cat, setCat] = useState<Cat>("face");
  const [age, setAge] = useState<string>("");
  const set = (k: AppearanceKey, v: number) => onChange({ ...value, [k]: v });
  const roll = (scope: RandomScope) => onChange(randomizeAppearance(value, scope, Rng.fromSeed(`${Date.now()}-${Math.random()}`)));
  const shownAge = age ? Number(age) : previewAge;

  const panel: Record<Cat, ReactNode> = {
    face: (
      <div className="grid gap-3">
        <Stepper label="Face shape" value={value.face} names={FACE_SHAPES.map((f) => f.name)} onChange={(v) => set("face", v)} />
        <Stepper label="Ears" value={value.ear} names={EAR_STYLES} onChange={(v) => set("ear", v)} />
        <div className="grid gap-2 rounded-xl border-2 border-line/20 p-3 sm:grid-cols-3">
          <Slider label="Head width" value={value.headW} onChange={(v) => set("headW", v)} />
          <Slider label="Head height" value={value.headH} onChange={(v) => set("headH", v)} />
          <Slider label="Ear size" value={value.earSc} onChange={(v) => set("earSc", v)} />
        </div>
      </div>
    ),
    skin: <Swatches label="Skin tone" value={value.skin} colors={SKIN_TONES} names={SKIN_NAMES} onChange={(v) => set("skin", v)} />,
    hair: <Stepper label="Hairstyle" value={value.hair} names={HAIR_STYLES.map((h) => h.name)} onChange={(v) => set("hair", v)} />,
    hairColor: (
      <div className="grid gap-3">
        <Swatches label="Hair colour" value={value.hairColor} colors={HAIR_COLORS} names={HAIR_COLOR_NAMES} onChange={(v) => onChange({ ...value, hairColor: v, browColor: v, facialColor: v })} />
        <Swatches label="Eyebrow colour" value={value.browColor} colors={HAIR_COLORS} names={HAIR_COLOR_NAMES} onChange={(v) => set("browColor", v)} />
        {supportsHairTips(value.hair) && <Swatches label="Tip colour" value={value.hairTip} colors={HAIR_TIP_COLORS} names={HAIR_TIP_NAMES} onChange={(v) => set("hairTip", v)} />}
      </div>
    ),
    eyes: (
      <div className="grid gap-3">
        <Stepper label="Eye shape" value={value.eyes} names={EYE_SHAPES} onChange={(v) => set("eyes", v)} />
        <Swatches label="Eye colour" value={value.eyeColor} colors={EYE_COLORS} names={EYE_COLOR_NAMES} onChange={(v) => set("eyeColor", v)} />
        <Slider label="Eye spacing" value={value.eyeSp} onChange={(v) => set("eyeSp", v)} />
      </div>
    ),
    brows: (
      <div className="grid gap-3">
        <Stepper label="Eyebrows" value={value.brow} names={BROW_STYLES} onChange={(v) => set("brow", v)} />
        <Slider label="Eyebrow angle" value={value.browAng} onChange={(v) => set("browAng", v)} />
      </div>
    ),
    nose: (
      <div className="grid gap-3">
        <Stepper label="Nose" value={value.nose} names={NOSE_STYLES} onChange={(v) => set("nose", v)} />
        <Slider label="Nose size" value={value.noseSc} onChange={(v) => set("noseSc", v)} />
      </div>
    ),
    mouth: <Stepper label="Mouth" value={value.mouth} names={MOUTH_STYLES} onChange={(v) => set("mouth", v)} />,
    facial: (
      <div className="grid gap-3">
        <Stepper label="Facial hair" value={value.facial} names={FACIAL_HAIR} onChange={(v) => set("facial", v)} />
        <Swatches label="Facial hair colour" value={value.facialColor} colors={HAIR_COLORS} names={HAIR_COLOR_NAMES} onChange={(v) => set("facialColor", v)} />
      </div>
    ),
    details: (
      <div className="grid gap-3">
        <Stepper label="Freckles" value={value.freckles} names={["None", "Freckles"]} onChange={(v) => set("freckles", v)} />
        <Stepper label="Scar" value={value.scar} names={SCARS} onChange={(v) => set("scar", v)} />
        <Stepper label="Mark" value={value.mark} names={MARKS} onChange={(v) => set("mark", v)} />
        <Stepper label="Accessory" value={value.accessory} names={ACCESSORIES} onChange={(v) => set("accessory", v)} />
        {(ACCESSORIES[value.accessory] === "Headband" || HAIR_STYLES[value.hair]?.name === "Long Headband Curls") && (
          <Swatches label="Headband colour" value={value.band} colors={BAND_COLORS} names={BAND_COLOR_NAMES} onChange={(v) => set("band", v)} />
        )}
        {ACCESSORIES[value.accessory] !== "Headband" && HAIR_STYLES[value.hair]?.name === "Divine Ponytail" && (
          <Swatches label="Hair tie colour" value={value.band} colors={BAND_COLORS} names={BAND_COLOR_NAMES} onChange={(v) => set("band", v)} />
        )}
      </div>
    ),
  };
  void COUNTS;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
        <div className="mx-auto grid justify-items-center gap-2">
          <PlayerPortrait appearance={value} age={shownAge} size={190} kit={kit} />
          <div className="text-center">
            <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-muted">Preview at age</div>
            <Tabs value={age || String(previewAge)} onChange={setAge} items={[{ id: String(previewAge), label: String(previewAge) }, ...PREVIEW_AGES.filter((x) => x.id !== String(previewAge))]} />
          </div>
        </div>
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button tone="sun" size="sm" onClick={() => roll("all")}>
              🎲 Randomize
            </Button>
            <Button tone="paper" size="sm" onClick={() => roll("face")}>
              Face
            </Button>
            <Button tone="paper" size="sm" onClick={() => roll("hair")}>
              Hair
            </Button>
          </div>
          <Tabs value={cat} onChange={setCat} items={CATS} />
          <div className="min-h-[150px] rounded-2xl border-2 border-line/30 bg-paper-2/50 p-3">{panel[cat]}</div>
        </div>
      </div>
    </div>
  );
}
