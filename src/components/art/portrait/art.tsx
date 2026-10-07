import { buildHead, type FaceSpec } from "./anatomy";
import { Brows, EyeSockets, Ears, Eyes, FacePlanes, Mouth, Neck, Nose, Shirt, skinPalette } from "./face";
import { FacialHair } from "./facialHair";
import { q, CX, INK, OUT, mix } from "./geometry";
import { HairBack, HairFront, HairOnSkin, hairGeometry, hairStyleOf, type HairCtx } from "./hair";
import { AgeLines, Details, Glasses, Headband } from "./details";

/** Everything needed to draw one portrait, already resolved from the stored appearance. */
export interface PortraitModel {
  f: FaceSpec;
  skin: string;
  iris: string;
  hair: number;
  hairColor: string;
  browColor: string;
  facial: number;
  facialColor: string;
  /** 0-1 hairline retreat, grey in facial hair, age lines, youthful softness. */
  recede: number;
  facialGrey: number;
  lines: number;
  youth: number;
  freckles: boolean;
  scar: number;
  mark: number;
  accessory: number;
  /** Headband colour, and the secondary (frosted tip) hair colour if any. */
  band: string;
  hairTip: string | null;
  kit: string;
  trim: string;
  background: string;
}

/** Portrait canvas framing: the head fills most of the card, the shirt shows at the shoulders. */
export const VIEW = { x: 10, y: 4, w: 280, h: 326 };

/** `textured` adds the retro print (grain, halftone); `lite` drops fine strands that cannot be seen at small sizes. */
export function PortraitArt({ m, uid, textured, lite = false }: { m: PortraitModel; uid: string; textured: boolean; lite?: boolean }) {
  const f = m.f;
  const head = buildHead(f);
  const skin = skinPalette(m.skin);
  const ctx: HairCtx = { style: hairStyleOf(m.hair), index: m.hair, color: m.hairColor, f, head, recede: m.recede, skin, uid, lite, tip: m.hairTip };
  const g = hairGeometry(ctx);
  const clip = `${uid}head`;
  const { x, y, w, h } = VIEW;
  return (
    <>
      <defs>
        <clipPath id={`${uid}card`}>
          <rect x={x} y={y} width={w} height={h} rx="16" />
        </clipPath>
        {/* The head outline is defined once and reused for the clip, the skin fill and the ink line. */}
        <path id={`${uid}hp`} d={head.path} />
        <clipPath id={clip}>
          <use href={`#${uid}hp`} />
        </clipPath>
        {textured && (
          <>
            <filter id={`${uid}grain`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="7" />
              <feColorMatrix values="0 0 0 0 0.12  0 0 0 0 0.08  0 0 0 0 0.05  0 0 0 0.55 -0.24" />
            </filter>
            <pattern id={`${uid}dots`} width="3.6" height="3.6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
              <circle cx="1.8" cy="1.8" r="0.75" fill={mix(skin.shade, "#3a160c", 0.35)} />
            </pattern>
          </>
        )}
      </defs>
      <g clipPath={`url(#${uid}card)`}>
        <rect x={x} y={y} width={w} height={h} fill={m.background} />
        <path d={q(`M${x} ${y + h * 0.62}C${x + w * 0.3} ${y + h * 0.56} ${x + w * 0.7} ${y + h * 0.7} ${x + w} ${y + h * 0.6}L${x + w} ${y + h}L${x} ${y + h}Z`)} fill={mix(m.background, "#000000", 0.12)} />
        <HairBack ctx={ctx} />
        <Neck f={f} head={head} skin={skin} />
        <Shirt kit={m.kit} trim={m.trim} f={f} />
        <Ears f={f} head={head} skin={skin} studs={m.accessory === 2} />
        <use href={`#${uid}hp`} fill={skin.base} />
        <g clipPath={`url(#${clip})`}>
          <FacePlanes f={f} head={head} skin={skin} halftone={textured ? `url(#${uid}dots)` : undefined} />
          <EyeSockets f={f} skin={skin} />
          <AgeLines f={f} skin={skin} lines={m.lines} />
          <HairOnSkin ctx={ctx} g={g} />
        </g>
        <use href={`#${uid}hp`} fill="none" stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <Details f={f} skin={skin} freckles={m.freckles} scar={m.scar} mark={m.mark} />
        <Nose f={f} skin={skin} />
        <Mouth f={f} skin={skin} />
        <Eyes f={f} skin={skin} iris={m.iris} uid={uid} lines={m.lines} />
        <Brows f={f} color={m.browColor} lite={lite} />
        <FacialHair f={f} head={head} style={m.facial} color={m.facialColor} grey={m.facialGrey} youth={m.youth} skin={skin} uid={uid} lite={lite} />
        <HairFront ctx={ctx} g={g} />
        {(m.accessory === 1 || ctx.style.name === "Long Headband Curls") && <Headband f={f} head={head} color={m.band} />}
        {m.accessory === 3 && <Glasses f={f} head={head} />}
        {textured && <rect x={x} y={y} width={w} height={h} filter={`url(#${uid}grain)`} opacity="0.35" style={{ mixBlendMode: "multiply" }} />}
      </g>
      <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} rx="15" fill="none" stroke={INK} strokeWidth="3" />
      <circle cx={CX} cy={-100} r="0" />
    </>
  );
}
