import { memo, useId, useMemo } from "react";
import { ageLook } from "@/engine/appearance/age";
import { BROW_STYLES, GEO_RANGES, HAIR_COLORS, HAIR_STYLES, INK, SKIN_TONES, geoValue } from "@/engine/appearance/options";
import { appearanceKey } from "@/engine/appearance/generate";
import type { Appearance } from "@/engine/types";
import { AgeLines, Details, FaceShading } from "./portrait/details";
import { Accessory, Brows, Collar, Ears, Eyes, Mouth, Neck, Nose, Shirt, skinPalette } from "./portrait/features";
import { FacialHair } from "./portrait/facialHair";
import { CX, contourFor, facePath, mix } from "./portrait/geometry";
import { HairBack, HairFront, hairTint } from "./portrait/hair";

export type PortraitSize = "small" | "medium" | "large" | number;
const PX: Record<"small" | "medium" | "large", number> = { small: 40, medium: 72, large: 120 };

export interface PlayerPortraitProps {
  appearance: Appearance;
  /** Current age. Changes only hair colour, lines and hairline; never identity. */
  age?: number;
  /** Shirt colour (club primary), optionally with a trim colour. */
  kit?: string | { primary: string; secondary?: string };
  size?: PortraitSize;
  className?: string;
  /** Background fill. Defaults to the game's warm paper tone. */
  background?: string;
}

// Keeping these out of the component means they are created once. The head fills roughly 70% of the frame.
const VIEW = "12 24 176 204";
const FX = 12;
const FY = 24;
const FW = 176;
const FH = 204;

/** Muted print-ink backgrounds: navy, green, brown, burgundy, slate, cream. */
const BACKDROPS = ["#2c3a52", "#2f4a3c", "#5b3d2a", "#56242f", "#4a6073", "#d8ccaa", "#3b3a52", "#6a5a3a"];
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dist = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
const norm = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : null);

/** Pick a backdrop from the face (stable per player) that stays clear of the shirt colour. */
function backdropFor(key: string, kit: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const k = norm(kit);
  for (let i = 0; i < BACKDROPS.length; i++) {
    const c = BACKDROPS[(h + i) % BACKDROPS.length];
    if (!k || dist(c, k) > 90) return c;
  }
  return BACKDROPS[0];
}

function PortraitSvg({ appearance: a, age = 24, kit = "#2e8b57", size = "medium", className = "", background }: PlayerPortraitProps) {
  const px = typeof size === "number" ? size : PX[size];
  const detailed = px >= 56;
  const textured = px >= 96;
  const kitMain = typeof kit === "string" ? kit : kit.primary;
  const trim = typeof kit === "string" ? "#f3efe4" : kit.secondary ?? "#f3efe4";

  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const backdrop = background ?? backdropFor(appearanceKey(a), kitMain);
  const art = useMemo(() => {
    const skin = skinPalette(SKIN_TONES[a.skin] ?? SKIN_TONES[0]);
    const contour = contourFor(a);
    const look = ageLook(a, age);
    const style = HAIR_STYLES[a.hair] ?? HAIR_STYLES[0];
    const hairColor = hairTint(HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0], look.grey);
    const browColor = hairTint(HAIR_COLORS[a.browColor] ?? HAIR_COLORS[0], look.grey * 0.7);
    const facialColor = hairTint(HAIR_COLORS[a.facialColor] ?? HAIR_COLORS[0], look.facialGrey);
    const spacing = geoValue("eyeSpacing", a.eyeSp);
    const angle = geoValue("eyebrowAngle", a.browAng);
    const hairCtx = { style, color: hairColor, contour, recede: look.recede, skin: skin.base };
    return { skin, contour, look, hairColor, browColor, facialColor, spacing, angle, hairCtx };
  }, [a, age]);

  const { skin, contour, look, browColor, facialColor, spacing, angle, hairCtx } = art;
  void GEO_RANGES;
  void BROW_STYLES;

  return (
    <svg width={px} height={Math.round(px * (FH / FW))} viewBox={VIEW} className={className} role="img" aria-label="Player portrait">
      <defs>
        <radialGradient id={`${uid}vig`} cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.32" />
        </radialGradient>
        <filter id="pbp-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="pbp-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="7" />
          <feColorMatrix values="0 0 0 0 0.1  0 0 0 0 0.07  0 0 0 0 0.04  0 0 0 0.8 -0.34" />
        </filter>
        <pattern id={`${uid}bg`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="2" cy="2" r="0.8" fill="#000" />
        </pattern>
        <clipPath id={`${uid}card`}>
          <rect x={FX} y={FY} width={FW} height={FH} rx="14" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}card)`}>
        <rect x={FX} y={FY} width={FW} height={FH} fill={backdrop} />
        <rect x={FX} y={FY} width={FW} height={FH} fill={`url(#${uid}vig)`} />
        {detailed && <rect x={FX} y={FY + FH * 0.45} width={FW} height={FH * 0.55} fill={`url(#${uid}bg)`} opacity="0.14" />}
        <g filter={detailed ? "url(#pbp-ink)" : undefined}>
          <Shirt kit={kitMain} />
          <HairBack {...hairCtx} />
          <Neck contour={contour} skin={skin} width={1} />
          <Collar trim={trim} />
          <Ears style={a.ear} scale={geoValue("earScale", a.earSc)} contour={contour} skin={skin} />
          <path d={facePath(contour)} fill={skin.base} stroke={INK} strokeWidth={2.8} strokeLinejoin="round" />
          <FaceShading contour={contour} skin={skin} uid={uid} halftone={detailed} age={age} />
          {detailed && <AgeLines age={look} skin={skin} contour={contour} />}
          {detailed && <Details a={a} skin={skin} />}
          <Nose style={a.nose} scale={geoValue("noseScale", a.noseSc)} skin={skin} />
          <Eyes shape={a.eyes} color={a.eyeColor} spacing={spacing} skin={skin} age={look} uid={uid} />
          <Brows style={a.brow} color={mix(browColor, "#000000", 0.15)} spacing={spacing} angle={angle} skin={skin} />
          <Mouth style={a.mouth} skin={skin} />
          <FacialHair style={a.facial} color={facialColor} contour={contour} grey={look.facialGrey} youth={look.youth} uid={uid} />
          <HairFront {...hairCtx} uid={uid} />
          <Accessory style={a.accessory} contour={contour} hair={hairCtx.color} />
        </g>
        {textured && <rect x={FX} y={FY} width={FW} height={FH} filter="url(#pbp-grain)" opacity="0.5" style={{ mixBlendMode: "multiply" }} />}
      </g>
      <rect x={FX + 1.5} y={FY + 1.5} width={FW - 3} height={FH - 3} rx="13" fill="none" stroke={INK} strokeWidth="3" />
      <circle cx={CX} cy={-100} r="0" />
    </svg>
  );
}

/** Reusable portrait. Memoised on the face data, so lists of players don't redraw. */
export const PlayerPortrait = memo(PortraitSvg, (p, n) => appearanceKey(p.appearance) === appearanceKey(n.appearance) && p.age === n.age && p.size === n.size && p.className === n.className && p.background === n.background && JSON.stringify(p.kit) === JSON.stringify(n.kit));
