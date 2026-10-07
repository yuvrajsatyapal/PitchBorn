import { memo, useId, useMemo } from "react";
import { appearanceKey } from "@/engine/appearance/generate";
import type { Appearance } from "@/engine/types";
import { FRAME, IllustratedArt } from "./illustrated/IllustratedArt";
import { isRenderable, selectArt } from "./illustrated/select";
import { PortraitArt, VIEW } from "./portrait/art";
import { modelFor } from "./portrait/specs";

export type PortraitSize = "small" | "medium" | "large" | number;
const PX: Record<"small" | "medium" | "large", number> = { small: 40, medium: 72, large: 120 };

export interface PlayerPortraitProps {
  appearance: Appearance;
  /** Current age. Changes only hair colour, lines, hairline and jaw softness in the teens; never identity. */
  age?: number;
  /** Shirt colour (club primary), optionally with a trim colour. */
  kit?: string | { primary: string; secondary?: string };
  size?: PortraitSize;
  className?: string;
  /** Background fill. Defaults to a muted print colour chosen per player and kept clear of the shirt. */
  background?: string;
}

const VIEWBOX = `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`;
const FRAMEBOX = `${FRAME.x} ${FRAME.y} ${FRAME.w} ${FRAME.h}`;

function PortraitSvg({ appearance, age = 24, kit = "#2e8b57", size = "medium", className = "", background }: PlayerPortraitProps) {
  const px = typeof size === "number" ? size : PX[size];
  // The retro print and the finest strands only show (and only cost) at larger sizes.
  const textured = px >= 96;
  const lite = px < 96;
  const kitMain = typeof kit === "string" ? kit : kit.primary;
  const trim = typeof kit === "string" ? "#f1ead8" : kit.secondary ?? "#f1ead8";
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // Hand-illustrated art is composed when every layer this player needs has been delivered (docs/PORTRAIT_ART.md).
  // Until then the interim vector renderer keeps the game playable; it is not the art direction.
  const art = useMemo(() => selectArt(appearance, age, kitMain, trim, background), [appearance, age, kitMain, trim, background]);
  const illustrated = isRenderable(art);
  const model = useMemo(() => (illustrated ? null : modelFor(appearance, age, kitMain, trim, background)), [illustrated, appearance, age, kitMain, trim, background]);
  if (illustrated || !model) {
    return (
      <svg width={px} height={Math.round((px * FRAME.h) / FRAME.w)} viewBox={FRAMEBOX} className={className} role="img" aria-label="Player portrait">
        <IllustratedArt sel={art} uid={uid} textured={textured} />
      </svg>
    );
  }
  return (
    <svg width={px} height={Math.round((px * VIEW.h) / VIEW.w)} viewBox={VIEWBOX} className={className} role="img" aria-label="Player portrait">
      <PortraitArt m={model} uid={uid} textured={textured} lite={lite} />
    </svg>
  );
}

/** Reusable portrait. Memoised on the face data, so lists of players don't redraw. */
export const PlayerPortrait = memo(PortraitSvg, (p, n) => appearanceKey(p.appearance) === appearanceKey(n.appearance) && p.age === n.age && p.size === n.size && p.className === n.className && p.background === n.background && JSON.stringify(p.kit) === JSON.stringify(n.kit));
