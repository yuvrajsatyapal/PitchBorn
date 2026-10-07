import { memo, useMemo } from "react";
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

// Keeping these out of the component means they are created once.
const VIEW = "4 16 192 218";

function PortraitSvg({ appearance: a, age = 24, kit = "#2e8b57", size = "medium", className = "", background = "var(--sun-2)" }: PlayerPortraitProps) {
  const px = typeof size === "number" ? size : PX[size];
  const detailed = px >= 56;
  const textured = px >= 96;
  const kitMain = typeof kit === "string" ? kit : kit.primary;
  const trim = typeof kit === "string" ? "#f3efe4" : kit.secondary ?? "#f3efe4";

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
    <svg width={px} height={Math.round(px * 1.135)} viewBox={VIEW} className={className} role="img" aria-label="Player portrait">
      <defs>
        <radialGradient id="pbp-vig" cx="50%" cy="42%" r="70%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
        </radialGradient>
        <filter id="pbp-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="pbp-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="7" />
          <feColorMatrix values="0 0 0 0 0.1  0 0 0 0 0.07  0 0 0 0 0.04  0 0 0 0.9 -0.35" />
        </filter>
      </defs>
      <rect x="4" y="16" width="192" height="218" rx="26" fill={background} />
      <rect x="4" y="16" width="192" height="218" rx="26" fill="url(#pbp-vig)" />
      <g filter={detailed ? "url(#pbp-ink)" : undefined}>
        <Shirt kit={kitMain} />
        <HairBack {...hairCtx} />
        <Neck contour={contour} skin={skin} width={1} />
        <Collar trim={trim} />
        <Ears style={a.ear} scale={geoValue("earScale", a.earSc)} contour={contour} skin={skin} />
        <path d={facePath(contour)} fill={skin.base} stroke={INK} strokeWidth={2.8} strokeLinejoin="round" />
        <FaceShading contour={contour} skin={skin} />
        {detailed && <AgeLines age={look} skin={skin} contour={contour} />}
        {detailed && <Details a={a} skin={skin} />}
        <Nose style={a.nose} scale={geoValue("noseScale", a.noseSc)} skin={skin} />
        <Eyes shape={a.eyes} color={a.eyeColor} spacing={spacing} skin={skin} age={look} />
        <Brows style={a.brow} color={mix(browColor, "#000000", 0.15)} spacing={spacing} angle={angle} skin={skin} />
        <Mouth style={a.mouth} skin={skin} />
        <FacialHair style={a.facial} color={facialColor} contour={contour} grey={look.facialGrey} youth={look.youth} />
        <HairFront {...hairCtx} />
        <Accessory style={a.accessory} contour={contour} hair={hairCtx.color} />
      </g>
      {textured && <rect x="4" y="16" width="192" height="218" rx="26" filter="url(#pbp-grain)" opacity="0.5" style={{ mixBlendMode: "multiply" }} />}
      <rect x="5.5" y="17.5" width="189" height="215" rx="25" fill="none" stroke={INK} strokeWidth="3" />
      <circle cx={CX} cy={-100} r="0" />
    </svg>
  );
}

/** Reusable portrait. Memoised on the face data, so lists of players don't redraw. */
export const PlayerPortrait = memo(PortraitSvg, (p, n) => appearanceKey(p.appearance) === appearanceKey(n.appearance) && p.age === n.age && p.size === n.size && p.className === n.className && p.background === n.background && JSON.stringify(p.kit) === JSON.stringify(n.kit));
