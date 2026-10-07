import { CX } from "../portrait/geometry";
import { HairBack, HairFront, HairOnSkin, hairGeometry, hairStyleOf, type HairCtx } from "../portrait/hair";
import { GlassesNext, HeadbandNext, MarksNext } from "./accessories";
import { anchorsFor } from "./anchors";
import { BackdropNext } from "./backdrop";
import { AgeLinesNext, BrowsNext, EarsNext, EyesNext, HeadInk, MouthNext, NoseNext, Planes, Sockets, type Detail } from "./face";
import { BeardNext, StubbleNext } from "./facialHair";
import { POC_IDS, drawHair, extentOf, hairMeta } from "./hair";
import { buildHeadNext } from "./head";
import { KitBack, KitFront, necklineFor } from "./kit";
import { NeckNext } from "./neck";
import type { NextModel } from "./model";
import { withDetail } from "./ink";
import { INK, skinTones } from "./palette";

/** Same aspect ratio as the current portrait. Thumbnails crop tight on the face; larger sizes show the shoulders. */
export const VIEW = { x: 10, y: 4, w: 280, h: 326 };
const WIDE = { x: 1, y: 1, w: 298, h: 347 };
export const viewFor = (d: Detail) => (d === 0 ? VIEW : WIDE);

/** Rendered width in pixels -> how much is drawn. Detail is added at size, never just scaled. */
export const detailFor = (px: number): Detail => (px < 72 ? 0 : px < 140 ? 1 : 2);

/**
 * The improved portrait: same data and canvas as the current one, drawn as an illustration (variable ink, organic
 * cel planes, tone-aware colour, suggested features). Styles without a new hair design still use the current hair.
 * `silhouette` is a review mode: the hair alone in solid black over a plain grey head.
 */
export function PortraitNext(props: { m: NextModel; uid: string; d: Detail; silhouette?: boolean }) {
  // Everything is drawn in one synchronous pass so all geometry is written at this size's precision.
  return withDetail(props.d, () => drawPortrait(props));
}

function drawPortrait({ m, uid, d, silhouette = false }: { m: NextModel; uid: string; d: Detail; silhouette?: boolean }) {
  const f = m.f;
  const head = buildHeadNext(f);
  const a = anchorsFor(f, head);
  const t = skinTones(m.skin);
  const ctx: HairCtx = { style: hairStyleOf(m.hair), index: m.hair, color: m.hairColor, f, head, recede: m.recede, skin: t, uid, lite: d === 0, tip: m.hairTip };
  const g = hairGeometry(ctx);
  const clip = `${uid}head`;
  const line = necklineFor(f, m.collar);
  const kitProps = { f, kit: m.kit, trim: m.trim, collar: m.collar, d, line };
  const box = viewFor(d);
  const { x, y, w, h } = box;
  const stubble = m.facial === 1 || m.facial === 2;
  const bald = m.hairStyle === "none";
  const pocId = m.hairStyle ?? POC_IDS[m.hair];
  const next = !bald && pocId ? drawHair(pocId, { f, head, color: m.hairColor, skin: t, uid, d, recede: m.recede, seed: m.seed, tip: m.hairTip, band: m.band }) : null;
  const legacy = !bald && !next;
  const meta = pocId ? hairMeta(pocId) : undefined;
  // A style with its own headband ignores the accessory; otherwise the band wraps whatever hair is at that height.
  const extent = next?.extent ?? (legacy ? extentOf(g.outer.slice().reverse()) : undefined);
  const band = next?.band ?? (m.accessory === 1 ? HeadbandNext({ head, a, color: m.band, d, extent }) : null);
  // An ear stud is only drawn where the ear shows.
  const stud = m.accessory === 2 && (meta?.ears ?? "visible") !== "covered";
  // The head turns very slightly on the neck; the pivot sits at the top of the neck so nothing detaches.
  const tilt = `rotate(${f.tilt.toFixed(2)} ${CX} ${f.jawY + 10})`;
  if (silhouette) {
    const black = `url(#${uid}black)`;
    return (
      <>
        <defs>
          <filter id={`${uid}black`}>
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
          </filter>
          <filter id={`${uid}grey`}>
            <feColorMatrix type="matrix" values="0 0 0 0 0.86  0 0 0 0 0.86  0 0 0 0 0.86  0 0 0 1 0" />
          </filter>
        </defs>
        <rect x={x} y={y} width={w} height={h} rx="16" fill="#fff" />
        <g transform={tilt}>
          <g filter={black}>{next ? next.back : legacy && HairBack({ ctx })}</g>
        </g>
        <g filter={`url(#${uid}grey)`}>
          {KitBack({ ...kitProps })}
          {NeckNext({ f, head, t, d, uid, line })}
          {KitFront({ ...kitProps })}
        </g>
        <g transform={tilt}>
          <path d={head.path} fill="#d6d6d6" />
          <g filter={black}>
            {next ? next.mid : legacy && HairFront({ ctx, g })}
            {next?.band}
            {next?.front}
          </g>
        </g>
        <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} rx="15.5" fill="none" stroke="#999" strokeWidth={d === 0 ? 4 : 2} />
      </>
    );
  }
  return (
    <>
      <defs>
        <clipPath id={`${uid}card`}>
          <rect x={x} y={y} width={w} height={h} rx="16" />
        </clipPath>
        <path id={`${uid}hp`} d={head.path} />
        <clipPath id={clip}>
          <use href={`#${uid}hp`} />
        </clipPath>
        {d === 2 && (
          <filter id={`${uid}grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="7" />
            <feColorMatrix values="0 0 0 0 0.12  0 0 0 0 0.08  0 0 0 0 0.05  0 0 0 0.5 -0.22" />
          </filter>
        )}
      </defs>
      <g clipPath={`url(#${uid}card)`}>
        {BackdropNext({ base: m.background, uid, seed: m.seed, d, box })}
        {/* 1. Hair behind the head and shoulders. */}
        <g transform={tilt}>
          {legacy && HairBack({ ctx })}
          {next?.back}
        </g>
        {/* 2. Shirt behind the neck (torso, inside of the opening, back of the collar), then the neck clipped to the
            opening, then the front of the collar: the neck goes into the shirt. */}
        {KitBack({ ...kitProps })}
        {NeckNext({ f, head, t, d, uid, line })}
        {KitFront({ ...kitProps })}
        <g transform={tilt}>
          {/* 3. Ears (over hair that goes behind them), the head, then everything that lies on the skin. */}
          {EarsNext({ f, head, t, d, stud })}
          <use href={`#${uid}hp`} fill={t.base} />
          <g clipPath={`url(#${clip})`}>
            {Planes({ f, head, t, d, uid })}
            {Sockets({ f, t })}
            {AgeLinesNext({ f, t, lines: m.lines, d })}
            {stubble && StubbleNext({ f, head, t, color: m.facialColor, heavy: m.facial === 2, youth: m.youth, d, uid })}
            {legacy && HairOnSkin({ ctx, g })}
            {next?.onSkin}
          </g>
          {HeadInk({ head, d })}
          {/* 4. Features, then facial hair over the lower face, then glasses on the nose. */}
          {MarksNext({ f, a, t, d, freckles: m.freckles, scar: m.scar, mark: m.mark })}
          {NoseNext({ f, t, d })}
          {MouthNext({ f, t, d })}
          {EyesNext({ f, t, iris: m.iris, uid, d, lines: m.lines })}
          {BrowsNext({ f, color: m.browColor, d })}
          {!stubble && BeardNext({ f, head, a, t, style: m.facial, color: m.facialColor, youth: m.youth, d, uid })}
          {m.accessory === 3 && GlassesNext({ f, head, a, d })}
          {/* 5. The hair mass (its arms pass under it to the ears), a headband over it, then locks in front of the band. */}
          {legacy && HairFront({ ctx, g })}
          {next?.mid}
          {band}
          {next?.front}
        </g>
        {d === 2 && <rect x={x} y={y} width={w} height={h} filter={`url(#${uid}grain)`} opacity="0.3" style={{ mixBlendMode: "multiply" }} />}
      </g>
      <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} rx="15.5" fill="none" stroke={INK} strokeWidth={d === 0 ? 5 : 2.5} />
    </>
  );
}
