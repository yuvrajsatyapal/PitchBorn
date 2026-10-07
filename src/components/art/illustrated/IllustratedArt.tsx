import type { ReactNode } from "react";
import { CANVAS, LANDMARKS as L, LAYER_ORDER } from "./canvas";
import { MANIFEST, fileKey, type Manifest, type Pick, type Selection } from "./select";
import type { Role, Slot } from "./slots";

/** The card shows the middle of the square master canvas, at the same proportions as the rest of the UI. */
export const FRAME = { x: 36, y: 0, w: 440, h: 512 } as const;
export const ASSET_BASE = "/portrait";

const MASKS: readonly Role[] = ["mask", "secondary-mask", "iris-mask", "lip-mask"];

/**
 * Composes delivered illustrations. Code never draws artwork here: it only stacks image layers, fills colour masks
 * and applies the fit transforms. With `preview`, a missing slot shows a labelled placeholder box (art checklist
 * only; never shipped to players, see PlayerPortrait).
 */
export function IllustratedArt({ sel, uid, textured, preview = false, manifest = MANIFEST, base = ASSET_BASE }: { sel: Selection; uid: string; textured: boolean; preview?: boolean; manifest?: Manifest; base?: string }) {
  const img = (slot: Slot, role: Role, extra: Record<string, unknown> = {}) => {
    const r = manifest[fileKey(slot, role)];
    if (!r) return null;
    return <image key={role} href={`${base}/${slot.path}/${role}.webp`} x={r[0]} y={r[1]} width={r[2]} height={r[3]} preserveAspectRatio="none" {...extra} />;
  };

  const layers = (p: Pick, key: string): ReactNode => {
    const { slot } = p;
    const out: ReactNode[] = [];
    for (const role of MASKS) {
      const r = manifest[fileKey(slot, role)];
      const tint = slot.tint?.[role];
      const color = tint ? p.colors[tint] : undefined;
      if (!r || !color) continue;
      const id = `${uid}${key}${role}`;
      out.push(
        <mask key={`m${role}`} id={id} maskUnits="userSpaceOnUse" x={r[0]} y={r[1]} width={r[2]} height={r[3]} style={{ maskType: "alpha" }}>
          {img(slot, role)}
        </mask>,
        <rect key={`f${role}`} x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill={color} mask={`url(#${id})`} />,
      );
    }
    out.push(img(slot, "white"));
    out.push(img(slot, "shadow", { style: { mixBlendMode: "multiply" }, opacity: p.shadow ?? 1 }));
    out.push(img(slot, "highlight", { style: { mixBlendMode: "screen" }, opacity: p.highlight ?? 1 }));
    out.push(img(slot, "detail"));
    out.push(img(slot, "ink"));
    if (textured) out.push(img(slot, "texture", { style: { mixBlendMode: "multiply" }, opacity: 0.35 }));
    if (preview && slot.roles.some((role) => !manifest[fileKey(slot, role)])) out.push(<Placeholder key="ph" pick={p} uid={uid} />);
    return out;
  };

  const render = (p: Pick, i: number): ReactNode => {
    const key = `${i}`;
    let body: ReactNode;
    if (p.split) {
      // Pairs (eyes, brows, ears) are drawn as one piece; each half is moved on its own for spacing and angle.
      const { dx, rotate = 0, pivotY = L.eye.y, pivotGap = 0 } = p.split;
      body = (
        <>
          <g transform={`translate(${-dx} 0) rotate(${-rotate} ${L.centreX - pivotGap} ${pivotY})`}>
            <g clipPath={`url(#${uid}left)`}>{layers(p, `${key}l`)}</g>
          </g>
          <g transform={`translate(${dx} 0) rotate(${rotate} ${L.centreX + pivotGap} ${pivotY})`}>
            <g clipPath={`url(#${uid}right)`}>{layers(p, `${key}r`)}</g>
          </g>
        </>
      );
    } else body = layers(p, key);
    return (
      <g key={`${p.slot.path}`} data-slot={p.slot.path} transform={p.transform}>
        {body}
      </g>
    );
  };

  const order = (p: Pick) => LAYER_ORDER.indexOf(p.slot.group);
  const sorted = sel.picks.map((p, i) => [p, i] as const).sort((a, b) => order(a[0]) - order(b[0]) || a[1] - b[1]);
  const onHead = (p: Pick) => p.slot.group !== "neck" && p.slot.group !== "kit" && p.slot.group !== "texture";
  return (
    <>
      <defs>
        <clipPath id={`${uid}card`}>
          <rect x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h} rx="28" />
        </clipPath>
        <clipPath id={`${uid}left`}>
          <rect x="0" y="0" width={L.centreX} height={CANVAS} />
        </clipPath>
        <clipPath id={`${uid}right`}>
          <rect x={L.centreX} y="0" width={L.centreX} height={CANVAS} />
        </clipPath>
        {preview && (
          <pattern id={`${uid}hatch`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0V10" stroke="#000" strokeWidth="2" />
          </pattern>
        )}
      </defs>
      <g clipPath={`url(#${uid}card)`}>
        <rect x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h} fill={sel.background} />
        {sorted.filter(([p]) => !onHead(p) && p.slot.group !== "texture").map(([p, i]) => render(p, i))}
        <g transform={sel.head}>{sorted.filter(([p]) => onHead(p)).map(([p, i]) => render(p, i))}</g>
        {textured && sorted.filter(([p]) => p.slot.group === "texture").map(([p, i]) => render(p, i))}
      </g>
      <rect x={FRAME.x + 2.5} y={FRAME.y + 2.5} width={FRAME.w - 5} height={FRAME.h - 5} rx="26" fill="none" stroke="#2a1b14" strokeWidth="5" />
    </>
  );
}

/** Missing art: a labelled box over the slot's area, filled with the colour the slot would take. Not artwork. */
function Placeholder({ pick, uid }: { pick: Pick; uid: string }) {
  const { slot } = pick;
  const [x, y, w, h] = slot.region;
  const tint = slot.tint?.mask ?? slot.tint?.["iris-mask"] ?? slot.tint?.["lip-mask"];
  const color = tint ? pick.colors[tint] : undefined;
  const labelled = slot.group === "hairFront" || slot.group === "hairBack" || slot.group === "face" || slot.group === "facialHair";
  if (slot.group === "texture") return null;
  return (
    <g data-placeholder={slot.path}>
      <rect x={x} y={y} width={w} height={h} rx="12" fill={color ?? "#9aa0a8"} fillOpacity={color ? 0.55 : 0.18} />
      <rect x={x} y={y} width={w} height={h} rx="12" fill={`url(#${uid}hatch)`} opacity={0.12} />
      <rect x={x} y={y} width={w} height={h} rx="12" fill="none" stroke="#111" strokeWidth="2" strokeDasharray="7 5" opacity={0.7} />
      {labelled && (
        <text x={x + 8} y={slot.group === "hairBack" ? y + h - 10 : y + 20} fontSize="15" fontFamily="sans-serif" fontWeight="700" fill="#fff" stroke="#111" strokeWidth="3" paintOrder="stroke">
          {slot.path}
        </text>
      )}
    </g>
  );
}
