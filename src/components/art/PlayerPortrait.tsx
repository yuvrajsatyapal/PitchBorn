import { memo, useId, useMemo } from "react";
import { appearanceKey } from "@/engine/appearance/generate";
import type { Appearance } from "@/engine/types";
import { PortraitNext, detailFor, viewFor } from "./portrait-next/art";
import type { Collar } from "./portrait-next/kit";
import { nextModelFor } from "./portrait-next/model";

export type PortraitSize = "small" | "medium" | "large" | number;
const PX: Record<"small" | "medium" | "large", number> = { small: 40, medium: 72, large: 120 };

export interface PlayerPortraitProps {
  appearance: Appearance;
  /** Current age. Changes only hair colour, lines, hairline and jaw softness in the teens; never identity. */
  age?: number;
  /** Shirt colour (club primary), optionally with a trim colour. */
  kit?: string | { primary: string; secondary?: string };
  /** Collar cut. Defaults to one per player; pass the club kit's collar so a whole squad matches. */
  collar?: Collar;
  size?: PortraitSize;
  className?: string;
  /** Background fill. Defaults to a muted print colour chosen per player and kept clear of the shirt. */
  background?: string;
}

function PortraitSvg({ appearance, age = 24, kit = "#2e8b57", size = "medium", className = "", background, collar }: PlayerPortraitProps) {
  const px = typeof size === "number" ? size : PX[size];
  // Thumbnails crop tight on the face and drop the finest strands; larger sizes show shoulders and full detail.
  const d = detailFor(px);
  const view = viewFor(d);
  const kitMain = typeof kit === "string" ? kit : kit.primary;
  const trim = typeof kit === "string" ? "#f1ead8" : kit.secondary ?? "#f1ead8";
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const model = useMemo(() => nextModelFor(appearance, age, kitMain, trim, background, collar), [appearance, age, kitMain, trim, background, collar]);
  return (
    <svg width={px} height={Math.round((px * view.h) / view.w)} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className={className} role="img" aria-label="Player portrait">
      <PortraitNext m={model} uid={uid} d={d} />
    </svg>
  );
}

/** Reusable portrait. Memoised on the face data, so lists of players don't redraw. */
export const PlayerPortrait = memo(PortraitSvg, (p, n) => appearanceKey(p.appearance) === appearanceKey(n.appearance) && p.age === n.age && p.size === n.size && p.className === n.className && p.background === n.background && p.collar === n.collar && JSON.stringify(p.kit) === JSON.stringify(n.kit));
