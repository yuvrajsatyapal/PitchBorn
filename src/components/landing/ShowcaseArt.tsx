import assets from "./career-assets.json";
import type { StageKey } from "./stages";

interface Props {
  stage: StageKey;
  variant: "main" | "thumb";
  className?: string;
  style?: React.CSSProperties;
  eager?: boolean;
}

/**
 * AVIF first, WebP fallback, at the intrinsic size of the variant so the browser never downloads more than it draws.
 * (next/image adds nothing here: the site is a static export with unoptimised images, so the variants are made ahead of
 * time by `npm run career:assets`.)
 */
export function ShowcaseArt({ stage, variant, className, style, eager = false }: Props) {
  const a = assets[stage];
  const base = `/images/career/${stage}-${variant}`;
  const width = variant === "main" ? a.width : a.thumbWidth;
  const height = variant === "main" ? a.height : a.thumbHeight;
  return (
    <picture>
      <source type="image/avif" srcSet={`${base}.avif`} />
      <source type="image/webp" srcSet={`${base}.webp`} />
      <img
        src={`${base}.webp`}
        width={width}
        height={height}
        alt=""
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        draggable={false}
        className={className}
        style={style}
      />
    </picture>
  );
}
