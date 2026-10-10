import type { ReactNode } from "react";

/**
 * Retro-editorial career illustrations for the landing page: a restrained, vintage-programme take on one player's
 * career. Every scene is drawn in a 400x300 box with the same thin charcoal line, muted palette, shade-shape + halftone
 * shading and the same adult back-view figure, so the hero and its five panels read as one art-directed set.
 * Scenes are split into depth layers (far / mid / fig / near) so the stage can drift them at different speeds.
 * Fixed colours on purpose (like Crest/Kit): the artwork must not invert with the dark theme.
 */
export const INK = "#2b2622";
const CREAM = "#f3e9d2";
const SUN = "#d9ad4a";
const SUN_LT = "#ecd391";
const CORAL = "#c86b58";
const TEAL = "#5b9295";
const BLUE = "#5a7ea9";
const GRASS = "#3f7656";
const GRASS_LT = "#4c8561";
const GRASS_DK = "#2f5d47";
const SKIN = "#d3a27c";
const SKIN_DK = "#b58660";
const SHADE = "#1c1a26";

const SW = 1.2;

export const LAYERS = ["far", "mid", "fig", "near"] as const;
export type LayerKey = (typeof LAYERS)[number];

export interface SceneDef {
  key: string;
  label: string;
  caption: string;
  /** viewBox for the small panel crop (aspect ≈ 1.87) */
  thumb: string;
  /** where the figure's feet are, as a percentage of the stage: the pivot for its walk */
  pivot: [number, number];
  /** end-of-shot figure scale and rise; walking away shrinks and lifts, a held pose barely moves */
  figScale: number;
  figRise: number;
}

export const SCENES: SceneDef[] = [
  { key: "academy", label: "Academy", caption: "A young player walks through the academy gates.", thumb: "62 112 276 148", pivot: [49, 96], figScale: 0.965, figRise: -5 },
  { key: "debut", label: "Debut", caption: "A first professional appearance, seen from the tunnel.", thumb: "50 100 300 160", pivot: [50, 98], figScale: 0.95, figRise: -6 },
  { key: "transfer", label: "Transfer", caption: "A big move to a new club, bag in hand.", thumb: "58 120 284 152", pivot: [49, 96], figScale: 0.97, figRise: -4 },
  { key: "trophies", label: "Trophies", caption: "A championship trophy lifted high.", thumb: "58 84 284 152", pivot: [50, 96], figScale: 1.015, figRise: 0 },
  { key: "legend", label: "Legend", caption: "A veteran's last walk at sunset.", thumb: "58 126 284 152", pivot: [47, 97], figScale: 0.96, figRise: -4 },
];

const f1 = (n: number) => n.toFixed(1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Pt = [number, number];
const pts = (p: Pt[]) => p.map(([x, y]) => `${f1(x)} ${f1(y)}`).join("L");

/* ───────────────────────── shared pieces ───────────────────────── */

function Layer({ children }: { children: ReactNode }) {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round">
      {children}
    </g>
  );
}

const Shade = ({ d, o = 0.16 }: { d: string; o?: number }) => <path d={d} fill={SHADE} opacity={o} stroke="none" />;
const Halftone = ({ d, o = 1 }: { d: string; o?: number }) => <path d={d} fill="url(#pbs-ht)" opacity={o} stroke="none" />;

function Sky({ id }: { id: string }) {
  return <rect x="-30" y="-30" width="460" height="360" fill={`url(#pbs-sky-${id})`} stroke="none" />;
}

/** Flat low-contrast cloud streak: no outline, atmosphere not subject. */
function Streak({ x, y, w, o = 0.5, c = CREAM }: { x: number; y: number; w: number; o?: number; c?: string }) {
  const d = `M${x} ${y} q${f1(w * 0.18)} -5 ${f1(w * 0.4)} -3 q${f1(w * 0.2)} -5 ${f1(w * 0.38)} 1 q${f1(w * 0.14)} 0 ${f1(w * 0.22)} 3 q${f1(-w * 0.5)} 4 ${f1(-w)} -1z`;
  return <path d={d} fill={c} opacity={o} stroke="none" />;
}

function Bands({ y0, y1, a, b, n = 6, grow = 0.32 }: { y0: number; y1: number; a: string; b: string; n?: number; grow?: number }) {
  const weights = Array.from({ length: n }, (_, i) => 1 + i * grow);
  const total = weights.reduce((acc, w) => acc + w, 0);
  let y = y0;
  return (
    <g stroke="none">
      {weights.map((w, i) => {
        const h = ((y1 - y0) * w) / total;
        const el = <rect key={i} x="-30" y={f1(y)} width="460" height={f1(h + 0.6)} fill={i % 2 ? b : a} />;
        y += h;
        return el;
      })}
    </g>
  );
}

/** Lattice floodlight mast. `y` is the top of the lamp head, `h` runs down to the base. */
function Mast({ x, y, h, lit = false }: { x: number; y: number; h: number; lit?: boolean }) {
  const rungs = Math.max(2, Math.floor(h / 14));
  return (
    <g strokeWidth="0.9">
      {lit && <ellipse cx={x} cy={y + 6} rx="40" ry="26" fill="url(#pbs-glow)" stroke="none" />}
      <path d={`M${x - 4} ${y + h}L${x - 1.6} ${y + 12}H${x + 1.6}L${x + 4} ${y + h}`} fill="#8e9a9d" />
      <path
        d={Array.from({ length: rungs }, (_, i) => {
          const t0 = i / rungs;
          const t1 = (i + 1) / rungs;
          const y0 = y + 12 + (h - 12) * t0;
          const y1 = y + 12 + (h - 12) * t1;
          const w0 = lerp(1.6, 4, t0);
          const w1 = lerp(1.6, 4, t1);
          return `M${f1(x - w0)} ${f1(y0)}L${f1(x + w1)} ${f1(y1)}M${f1(x + w0)} ${f1(y0)}L${f1(x - w1)} ${f1(y1)}`;
        }).join("")}
        fill="none"
        strokeWidth="0.6"
        opacity=".7"
      />
      <rect x={x - 12} y={y} width="24" height="13" rx="1.5" fill="#5a676d" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx={x - 8.4 + i * 5.6} cy={y + 4} r="1.7" fill={lit ? "#fff3c8" : CREAM} stroke="none" />
          <circle cx={x - 8.4 + i * 5.6} cy={y + 9} r="1.7" fill={lit ? "#fff3c8" : CREAM} stroke="none" />
        </g>
      ))}
    </g>
  );
}

/** Frontal grandstand: crowd-patterned tiers split by a concourse, aisles, and advertising boards along the front. */
function Stand({ x, y, w, h, tiers = 2, aisle = 26, boards = true }: { x: number; y: number; w: number; h: number; tiers?: number; aisle?: number; boards?: boolean }) {
  const th = h / tiers;
  const palette = ["#4f7694", CORAL, SUN, TEAL, "#7c6a8a", CREAM];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#2d2a38" />
      {Array.from({ length: tiers }, (_, t) => {
        const ty = y + t * th;
        const ch = th - (t < tiers - 1 ? 3.5 : 0);
        const rows = Math.max(2, Math.round(ch / 4.6));
        return (
          <g key={t}>
            <rect x={x} y={ty} width={w} height={ch} fill="url(#pbs-crowd)" stroke="none" />
            <path d={Array.from({ length: rows }, (_, r) => `M${x} ${f1(ty + ((r + 1) * ch) / rows)}H${x + w}`).join("")} stroke={SHADE} strokeWidth="0.7" opacity=".35" />
            <Shade d={`M${x} ${ty}h${w}v${f1(ch * 0.2)}h${-w}z`} o={0.22} />
          </g>
        );
      })}
      <path d={Array.from({ length: Math.floor(w / aisle) }, (_, i) => `M${f1(x + aisle * (i + 0.5))} ${y}v${h}`).join("")} stroke={SHADE} strokeWidth="1.1" opacity=".55" />
      {boards && (
        <g strokeWidth="0.7">
          {Array.from({ length: Math.ceil(w / 22) }, (_, i) => (
            <rect key={i} x={x + i * 22} y={y + h} width="22" height="6.5" fill={palette[i % palette.length]} />
          ))}
          <Shade d={`M${x} ${y + h}h${w}v6.5h${-w}z`} o={0.18} />
        </g>
      )}
      <rect x={x} y={y} width={w} height={h} fill="none" />
    </g>
  );
}

/** Slanted wing stand: crowd polygon with rows interpolated between its top and bottom edges. */
function Wing({ p, rows = 7 }: { p: [Pt, Pt, Pt, Pt]; rows?: number }) {
  const [a, b, c, d] = p; // a→b top edge, d→c bottom edge
  return (
    <g>
      <path d={`M${pts(p)}z`} fill="url(#pbs-crowd)" />
      <path
        d={Array.from({ length: rows - 1 }, (_, k) => {
          const t = (k + 1) / rows;
          return `M${f1(lerp(a[0], d[0], t))} ${f1(lerp(a[1], d[1], t))}L${f1(lerp(b[0], c[0], t))} ${f1(lerp(b[1], c[1], t))}`;
        }).join("")}
        stroke={SHADE}
        strokeWidth="0.7"
        opacity=".35"
      />
      <Shade d={`M${pts(p)}z`} o={0.14} />
    </g>
  );
}

function Roof({ x, y, w, d = 9 }: { x: number; y: number; w: number; d?: number }) {
  const n = Math.floor(w / 12);
  return (
    <g>
      <path d={`M${x - 8} ${y}H${x + w + 8}L${x + w + 3} ${y + d}H${x - 3}z`} fill="#4c5560" />
      <path d={Array.from({ length: n }, (_, i) => `M${f1(x + i * 12)} ${y + d}l6 ${-d}l6 ${d}`).join("")} fill="none" strokeWidth="0.6" opacity=".6" />
      <path d={`M${x - 8} ${y}H${x + w + 8}`} stroke="#c9d1d2" strokeWidth="0.8" opacity=".5" />
    </g>
  );
}

function Ball({ x, y, r = 8 }: { x: number; y: number; r?: number }) {
  const k = r / 8;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} strokeWidth={SW / k}>
      <ellipse cx="3" cy="7.4" rx="9" ry="2.2" fill={SHADE} opacity=".2" stroke="none" />
      <circle r="8" fill={CREAM} />
      <path d="M0-3.6l3.4 2.5-1.3 4h-4.2l-1.3-4z" fill={INK} stroke="none" />
      <path d="M0-3.6V-8M3.4-1.1l4.2-1.4M2.1 2.9l2.6 3.6M-2.1 2.9l-2.6 3.6M-3.4-1.1l-4.2-1.4" fill="none" strokeWidth={0.8 / k} />
      <path d="M-4.6 5.4A8 8 0 0 0 6 4.8 8 8 0 0 1-4.6 5.4z" fill={SHADE} opacity=".18" stroke="none" />
    </g>
  );
}

function Cone({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} strokeWidth={SW / s}>
      <ellipse cx="2" cy="1" rx="9" ry="2.2" fill={SHADE} opacity=".2" stroke="none" />
      <path d="M-6.5 0L-1.6-14H1.6L6.5 0z" fill={CORAL} />
      <path d="M-4.2-6H4.2l-.9-3.2h-2.4z" fill={CREAM} stroke="none" />
      <path d="M1.6-14L6.5 0H2.5z" fill={SHADE} opacity=".2" stroke="none" />
      <rect x="-7.5" y="-1.6" width="15" height="2.6" rx="1" fill={CORAL} />
    </g>
  );
}

function Trophy({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const w = SW / s;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} strokeWidth={w}>
      <path d="M-9-27q-7.5 0-6 6.4 1.4 5.2 8.4 6.6M9-27q7.5 0 6 6.4-1.4 5.2-8.4 6.6" fill="none" stroke={INK} strokeWidth={3.5} />
      <path d="M-9-27q-7.5 0-6 6.4 1.4 5.2 8.4 6.6M9-27q7.5 0 6 6.4-1.4 5.2-8.4 6.6" fill="none" stroke={SUN} strokeWidth={1.9} />
      <path d="M-2.4-9h4.8v7h-4.8z" fill="#c29536" />
      <ellipse cx="0" cy="-10" rx="4.6" ry="1.7" fill="#c29536" />
      <path d="M-9-31H9Q9-15 4.4-11.4H-4.4Q-9-15-9-31z" fill={SUN} />
      <ellipse cx="0" cy="-31" rx="9" ry="2.3" fill={SUN_LT} />
      <path d="M3.4-30Q9-30 9-31Q9-15 4.4-11.4H1.4Q4.2-17 3.4-30z" fill="#8a6420" opacity=".45" stroke="none" />
      <path d="M-5.6-27.6Q-5.4-18.6-3-14" fill="none" stroke="#fbefc2" strokeWidth={1.3} opacity=".85" />
      <path d="M-8-3H8V0H-8z M-6-6H6V-3H-6z" fill="#a97f2e" />
    </g>
  );
}

/* ───────────────────────── the player ───────────────────────── */

interface FigureProps {
  x: number;
  y: number;
  s?: number;
  kit: string;
  trim: string;
  shorts: string;
  socks: string;
  number: number;
  name: string;
  hair?: string;
  /** same player, different chapters: youth is smaller with a proportionally larger head; veteran is grey */
  age?: "youth" | "adult" | "veteran";
  arms?: "down" | "up";
  bag?: string;
  /** warm back-light along the head and shoulders, for contre-jour shots */
  rim?: string;
}

function Limb({ d, w, color }: { d: string; w: number; color: string }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + 2.2} />
      <path d={d} fill="none" stroke={color} strokeWidth={w} />
    </>
  );
}

/** A footballer seen from behind: roughly 7.5 heads tall, ~114 units. Origin is the centre of the feet. */
function Figure({ x, y, s = 1, kit, trim, shorts, socks, number, name, hair = "#3f2a1d", age = "adult", arms = "down", bag, rim }: FigureProps) {
  const k = age === "youth" ? 0.86 : 1;
  const sw = (SW * 0.95) / (s * k);
  const nameLen = Math.min(20, Math.max(11, name.length * 3.1));
  const leg = (
    <>
      <path d="M3.3-27L2.9-41H11.4L10.4-27z" fill={SKIN} />
      <path d="M4.3-4.6L3.6-15Q3.1-22 3.3-28H10.6Q11.1-22 9.8-14L8.9-4.6z" fill={socks} />
      <path d="M3.3-25.4H10.5" stroke={trim} strokeWidth={sw * 1.5} fill="none" />
      <path d="M8.1-27Q9.9-17 8.7-5L9.2-4.6 10.4-27z" fill={SHADE} opacity=".16" stroke="none" />
      <path d="M3-5L9.6-5Q10.8-2.4 10.8-1Q10.8 0 9.6 0L2.5 0Q1.4 0 1.6-1.2Q2.4-3 3-5z" fill="#37312c" />
      <path d="M2.2-1H10.4" stroke={CREAM} strokeWidth={sw * 0.7} opacity=".55" fill="none" />
    </>
  );
  const sleeve = "M12.4-93.4Q18.8-92.4 20.2-85.6L19.8-77.4Q16.4-76 13.2-77.8z";
  return (
    <g transform={`translate(${x} ${y}) scale(${s * k})`} stroke={INK} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
      <ellipse cx="0" cy="0.6" rx="19" ry="3.4" fill={SHADE} opacity=".22" stroke="none" />
      <g transform="translate(-0.6 0)">
        <g transform="scale(-1 1)">{leg}</g>
      </g>
      {leg}
      {/* shorts */}
      <path d="M-12.4-58H12.4L13.9-39Q7.6-37.4 1.2-39L0-47-1.2-39Q-7.6-37.4-13.9-39z" fill={shorts} />
      <path d="M2-58H12.4L13.9-39Q9-38 6.4-38.4Q8.4-47 2-58z" fill={SHADE} opacity=".16" stroke="none" />
      <path d="M-12.4-56.2Q0-54.8 12.4-56.2" fill="none" stroke={trim} strokeWidth={sw * 1.2} opacity=".8" />
      {/* torso */}
      <path d="M-11.6-55Q0-53.4 11.6-55L10.7-62 13.6-80Q16.9-86 15.2-91Q8-95.2 0-94.6Q-8-95.2-15.2-91Q-16.9-86-13.6-80L-10.7-62z" fill={kit} />
      <path d="M5-94.4Q12-94.4 15.2-91Q16.9-86 13.6-80L10.7-62 11.6-55H6Q8.6-75 5-94.4z" fill={SHADE} opacity=".16" stroke="none" />
      <path d="M-13.6-80L-10.7-62M13.6-80L10.7-62" stroke={SHADE} strokeWidth={sw * 2.4} opacity=".1" fill="none" />
      <Halftone d="M9.6-82L13.6-80 10.7-62 8.6-62z" o={0.7} />
      <path d="M-12.4-92.6Q0-90.2 12.4-92.6" fill="none" stroke={trim} strokeWidth={sw * 1.1} opacity=".75" />
      {/* arms */}
      {arms === "down" ? (
        <>
          <Limb d="M17.6-78Q21.8-68 20.4-60Q19.9-57.4 19.6-55.4" w={4.8} color={SKIN} />
          <Limb d="M-17.6-78Q-21.8-68-20.4-60Q-19.9-57.4-19.6-55.4" w={4.8} color={SKIN} />
          <ellipse cx="19.5" cy="-52.4" rx="2.4" ry="3.4" fill={SKIN} />
          <ellipse cx="-19.5" cy="-52.4" rx="2.4" ry="3.4" fill={SKIN} />
          <path d={sleeve} fill={kit} />
          <path d={sleeve} fill={kit} transform="scale(-1 1)" />
          <path d="M13.2-77.8Q16.4-76 19.8-77.4M-13.2-77.8Q-16.4-76-19.8-77.4" stroke={trim} strokeWidth={sw * 1.3} fill="none" />
        </>
      ) : (
        <>
          <Limb d="M14-90Q23.4-96 24-107Q23.4-116 10.4-125" w={4.6} color={SKIN} />
          <Limb d="M-14-90Q-23.4-96-24-107Q-23.4-116-10.4-125" w={4.6} color={SKIN} />
          <Limb d="M14.6-91Q20-94 22.8-99" w={6} color={kit} />
          <Limb d="M-14.6-91Q-20-94-22.8-99" w={6} color={kit} />
        </>
      )}
      {/* neck + head */}
      <path d="M-3.5-95.6H3.5L3.1-100H-3.1z" fill={SKIN_DK} />
      <g transform={age === "youth" ? "translate(0 -99) scale(1.14) translate(0 99)" : undefined}>
        <ellipse cx="-6.3" cy="-105.4" rx="1.4" ry="2.1" fill={SKIN_DK} />
        <ellipse cx="6.3" cy="-105.4" rx="1.4" ry="2.1" fill={SKIN_DK} />
        <ellipse cx="0" cy="-105.6" rx="6.4" ry="7.6" fill={SKIN} />
        <path d="M-6.7-105C-7.5-114.6 7.5-114.6 6.7-105C6.4-102.2 5.4-100.6 4.5-100L2.7-101.4Q0-100.6-2.7-101.4L-4.5-100C-5.4-100.6-6.4-102.2-6.7-105z" fill={hair} />
        <path d="M2.2-111.6Q6.4-110 6.4-105L6.7-105C7.4-114 3.4-114.2 2.2-111.6z" fill={SHADE} opacity=".22" stroke="none" />
        <path d="M-3.4-111.6Q0-113 3-111.8" fill="none" stroke={CREAM} strokeWidth={sw * 0.8} opacity={age === "veteran" ? 0.5 : 0.28} />
      </g>
      <text x="0" y="-80.6" textAnchor="middle" fontSize="4.6" fontFamily="var(--font-lilita), sans-serif" fill={trim} stroke="none" textLength={nameLen} lengthAdjust="spacingAndGlyphs" opacity=".92">
        {name}
      </text>
      <text x="0" y="-65.8" textAnchor="middle" fontSize="14.5" fontFamily="var(--font-lilita), sans-serif" fill={trim} stroke="none" opacity=".95">
        {number}
      </text>
      {bag && (
        <g>
          <path d="M17-45L19.5-50.6 31.5-45" fill="none" strokeWidth={sw * 1.2} />
          <rect x="15" y="-45" width="19" height="17" rx="4" fill={bag} />
          <path d="M15.6-39H33.4" stroke={CREAM} strokeWidth={sw * 1.5} opacity=".85" fill="none" />
          <path d="M26 -45v17" stroke={SHADE} strokeWidth={sw * 0.7} opacity=".35" fill="none" />
          <path d="M29-45h5v17h-5z" fill={SHADE} opacity=".16" stroke="none" />
        </g>
      )}
      {arms === "up" && <Trophy x={0} y={-123} s={0.95} />}
      {rim && (
        <g fill="none" stroke={rim} strokeWidth={sw * 1.1} opacity=".85">
          <path d="M-6.2-108.6C-5-113 2.4-114 5.4-110.4" />
          <path d="M-15-91.4Q-8-94.8-1.4-94.4" />
          <path d="M1.4-94.4Q8-94.8 15-91.4" />
        </g>
      )}
    </g>
  );
}

/* ───────────────────────── scenes (400x300) ───────────────────────── */

type Layers = Record<LayerKey, ReactNode>;

function Academy({ name }: { name: string }): Layers {
  const wingWin = (x: number) => (
    <g key={x}>
      <path d={`M${x} 190V168Q${x} 158 ${x + 7} 158T${x + 14} 168V190z`} fill="#7897ac" />
      <path d={`M${x + 7} 158V190M${x} 175H${x + 14}`} strokeWidth="0.7" fill="none" />
      <path d={`M${x + 8} 168Q${x + 14} 166 ${x + 14} 168V190H${x + 8}z`} fill={SHADE} opacity=".18" stroke="none" />
      <path d={`M${x - 2} 190h18`} strokeWidth="1.6" fill="#b89f77" />
    </g>
  );
  const quoins = Array.from({ length: 7 }, (_, i) => (
    <g key={i} stroke="none" fill="#cdb78c">
      <rect x="146" y={118 + i * 14} width={i % 2 ? 6 : 9} height="7" />
      <rect x={i % 2 ? 248 : 245} y={118 + i * 14} width={i % 2 ? 6 : 9} height="7" />
    </g>
  ));
  const bricks = (x0: number, x1: number) => Array.from({ length: 9 }, (_, i) => `M${x0} ${150 + i * 8}H${x1}`).join("");
  const tree = (cx: number, base: number, sc: number) => (
    <g transform={`translate(${cx} ${base}) scale(${sc})`} strokeWidth={SW / sc}>
      <path d="M-3 0L-2.2-32H2.2L3 0z" fill="#6b4e38" />
      <circle cx="0" cy="-48" r="23" fill="#5d8869" />
      <circle cx="-17" cy="-36" r="15" fill="#4d7a5e" />
      <circle cx="17" cy="-37" r="16" fill="#6d9876" />
      <circle cx="2" cy="-62" r="14" fill="#6d9876" />
      <Halftone d="M-6-30Q10-26 22-42Q24-24 10-18Q-4-16-6-30z" o={0.8} />
      <Shade d="M4-40Q18-44 22-34Q20-24 8-22Q8-30 4-40z" o={0.14} />
    </g>
  );
  return {
    far: (
      <Layer>
        <Sky id="academy" />
        <circle cx="318" cy="108" r="64" fill="url(#pbs-sun-glow)" stroke="none" />
        <circle cx="318" cy="108" r="18" fill="#f7e6b6" stroke="none" />
        <Streak x={36} y={74} w={110} o={0.55} />
        <Streak x={230} y={52} w={86} o={0.4} />
        <Streak x={300} y={146} w={70} o={0.35} />
        <path d="M-30 170Q36 128 108 152T250 144T430 156V230H-30z" fill="#a1bba9" stroke="none" />
        <path d="M-30 188Q60 156 150 174T330 166T430 178V236H-30z" fill="#86a891" stroke="none" />
        <rect x="-30" y="196" width="460" height="30" fill="url(#pbs-haze)" stroke="none" />
      </Layer>
    ),
    mid: (
      <Layer>
        {tree(40, 218, 1)}
        {tree(364, 218, 0.92)}
        <rect x="-30" y="203" width="96" height="15" rx="7" fill="#4d7a5e" />
        <rect x="334" y="203" width="96" height="15" rx="7" fill="#4d7a5e" />
        {/* wings */}
        <rect x="62" y="146" width="88" height="70" fill="#e6d4ae" />
        <rect x="250" y="146" width="88" height="70" fill="#e6d4ae" />
        <path d={bricks(62, 148)} stroke="#b99f73" strokeWidth="0.5" opacity=".4" fill="none" />
        <path d={bricks(252, 338)} stroke="#b99f73" strokeWidth="0.5" opacity=".4" fill="none" />
        <path d="M56 148L68 130H148V148z" fill="#4b6468" />
        <path d="M252 148V130H332L344 148z" fill="#4b6468" />
        <Shade d="M290 148V130H332L344 148z" o={0.18} />
        {[74, 98, 122].map(wingWin)}
        {[266, 290, 314].map(wingWin)}
        {/* central block */}
        <rect x="146" y="112" width="108" height="104" fill="#e8d6b0" />
        <path d="M138 114L200 86 262 114z" fill="#4b6468" />
        <path d="M152 112L200 92 248 112z" fill="#dcc8a2" />
        <Shade d="M200 86L262 114H238z" o={0.18} />
        {quoins}
        <rect x="160" y="116" width="80" height="19" rx="2" fill={CREAM} />
        <text x="200" y="130" textAnchor="middle" fontSize="12.5" fontFamily="var(--font-lilita), sans-serif" fill={INK} stroke="none" textLength="62" lengthAdjust="spacingAndGlyphs">
          ACADEMY
        </text>
        <path d="M160 135H240" stroke="#b99f73" strokeWidth="1.4" fill="none" />
        <path d="M168 216V176Q168 148 200 148T232 176V216z" fill="#243f36" />
        <path d="M176 216V178Q176 157 200 157T224 178V216z" fill="#5a8a6e" />
        <path d="M184 216V159M192 216V157M200 216V157M208 216V157M216 216V159" strokeWidth="0.7" fill="none" opacity=".7" />
        <path d="M176 196H224" strokeWidth="0.8" fill="none" opacity=".6" />
        <path d="M200 157Q224 157 224 178V216H200z" fill={SHADE} opacity=".2" stroke="none" />
        <rect x="158" y="146" width="10" height="70" fill="#d5bf93" />
        <rect x="232" y="146" width="10" height="70" fill="#d5bf93" />
        <path d="M196 144h8l-2 8h-4z" fill="#b99f73" />
        <rect x="62" y="208" width="276" height="8" fill="#b89f77" />
        <path d="M200 86V66" strokeWidth="1.2" fill="none" />
        <path d="M200 66l17 5-17 6z" fill={CORAL} />
        {/* ground */}
        <Bands y0={216} y1={330} a={GRASS_LT} b={GRASS} n={6} grow={0.45} />
        <path d="M176 216H224L300 330H100z" fill="#e3d1a9" />
        <path d="M176 216L100 330M224 216L300 330" fill="none" strokeWidth="1" />
        <Shade d="M176 216H224L300 330H240z" o={0.08} />
        <path d="M150 262l6-2M236 248l7 1M208 290l8-1M170 236l5 1M252 280l6 1" strokeWidth="1.4" opacity=".28" fill="none" />
        <Cone x={64} y={256} s={0.9} />
        <Cone x={90} y={268} s={1.05} />
        <Cone x={120} y={284} s={1.2} />
        <Ball x={336} y={270} r={8.5} />
      </Layer>
    ),
    fig: (
      <Layer>
        <Figure x={198} y={292} s={1.2} kit="#86afcc" trim="#2b3a4f" shorts={CREAM} socks="#86afcc" number={17} name={name} age="youth" bag={CORAL} />
      </Layer>
    ),
    near: (
      <Layer>
        <path d="M-30 330Q-16 276 30 280Q62 282 78 330z" fill="#3b6850" />
        <path d="M-30 330Q-20 296 8 298Q30 302 36 330z" fill="#2f5a43" />
        <Halftone d="M20 290Q54 288 66 322L40 322z" o={0.7} />
        <path d="M430 330Q418 280 372 286Q338 290 326 330z" fill="#3b6850" />
        <path d="M430 330Q420 298 396 300Q374 304 366 330z" fill="#2f5a43" />
        <rect x="-30" y="-30" width="460" height="360" fill="url(#pbs-vignette)" stroke="none" />
      </Layer>
    ),
  };
}

function Debut({ name }: { name: string }): Layers {
  const O = { l: 108, r: 292, t: 70, b: 198 };
  const wallLine = (t: number, side: "l" | "r") => {
    const sx = side === "l" ? -30 : 430;
    const ox = side === "l" ? O.l : O.r;
    return `M${f1(lerp(sx, ox, t))} ${f1(lerp(-30, O.t, t))}L${f1(lerp(sx, ox, t))} ${f1(lerp(330, O.b, t))}`;
  };
  const strip = (u: number) => {
    const w = 0.011;
    const bx = (uu: number) => lerp(O.l, O.r, uu);
    const tx = (uu: number) => lerp(-30, 430, uu);
    return `M${f1(bx(u - w))} ${O.t}L${f1(bx(u + w))} ${O.t}L${f1(tx(u + w * 1.8))} 6L${f1(tx(u - w * 1.8))} 6z`;
  };
  const floorLines = Array.from({ length: 11 }, (_, i) => {
    const xb = -30 + i * 46;
    const xa = 200 + (xb - 200) * 0.3265;
    return `M${f1(xa)} ${O.b}L${xb} 330`;
  }).join("");
  return {
    far: (
      <Layer>
        <Sky id="debut" />
        <Wing p={[[96, 74], [136, 88], [136, 136], [96, 148]]} />
        <Wing p={[[304, 74], [264, 88], [264, 136], [304, 148]]} />
        <Stand x={118} y={84} w={164} h={50} tiers={2} aisle={20} />
        <Roof x={110} y={72} w={180} d={8} />
        <rect x="-30" y="132" width="460" height="8" fill="#2b3a4a" stroke="none" />
        <Bands y0={140} y1={330} a={GRASS} b={GRASS_LT} n={7} grow={0.4} />
        <rect x="-30" y="138" width="460" height="48" fill="url(#pbs-haze)" stroke="none" />
        <path d="M168 140L158 162H242L232 140" fill="none" stroke={CREAM} strokeWidth="0.9" opacity=".8" />
        <path d="M184 128H216V140H184z" fill="none" stroke={CREAM} strokeWidth="1" opacity=".9" />
        <path d="M184 134H216M190 128V140M200 128V140M210 128V140" stroke={CREAM} strokeWidth="0.4" opacity=".6" fill="none" />
        <path d="M110 150L40 330M290 150L360 330" stroke={CREAM} strokeWidth="1" opacity=".5" fill="none" />
        <circle cx="146" cy="76" r="14" fill="url(#pbs-glow)" stroke="none" />
        <circle cx="254" cy="76" r="14" fill="url(#pbs-glow)" stroke="none" />
      </Layer>
    ),
    mid: (
      <Layer>
        <path d={`M-30 -30H430L${O.r} ${O.t}H${O.l}z`} fill="#22352f" />
        <path d={`M-30 -30L${O.l} ${O.t}V${O.b}L-30 330z`} fill="#33504a" />
        <path d={`M430 -30L${O.r} ${O.t}V${O.b}L430 330z`} fill="#3a5a52" />
        <path d={`M-30 330L${O.l} ${O.b}H${O.r}L430 330z`} fill="#496c60" />
        <path d={[0.2, 0.42, 0.66, 0.86].map((t) => wallLine(t, "l") + wallLine(t, "r")).join("")} stroke={SHADE} strokeWidth="1" opacity=".4" fill="none" />
        <path d={`M-30 160L${O.l} 128M430 160L${O.r} 128`} stroke="#9bb3a6" strokeWidth="1.1" opacity=".45" fill="none" />
        <path d={`M-30 250L${O.l} 176M430 250L${O.r} 176`} stroke={SHADE} strokeWidth="2.4" opacity=".28" fill="none" />
        <Shade d={`M-30 -30L${O.l} ${O.t}V${O.b}L-30 330z`} o={0.12} />
        <Halftone d={`M-30 120L${O.l} 122V${O.b}L-30 330z`} o={0.55} />
        <path d={floorLines} stroke={SHADE} strokeWidth="0.7" opacity=".3" fill="none" />
        <path d={`M${O.l - 6} 212H${O.r + 6}M${O.l - 24} 238H${O.r + 24}M${O.l - 52} 276H${O.r + 52}`} stroke={SHADE} strokeWidth="0.7" opacity=".25" fill="none" />
        <path d={`M${O.l} ${O.b}H${O.r}L372 330H28z`} fill="url(#pbs-spill)" stroke="none" />
        <path d={strip(0.3)} fill="#f0dca4" opacity=".9" strokeWidth="0.8" />
        <path d={strip(0.7)} fill="#f0dca4" opacity=".9" strokeWidth="0.8" />
        <path d={`M${O.l} ${O.t}H${O.r}`} stroke="#c8b27a" strokeWidth="2" />
      </Layer>
    ),
    fig: (
      <Layer>
        <Figure x={200} y={296} s={1.42} kit="#d8cdb4" trim="#2e3d52" shorts="#2e3d52" socks="#d8cdb4" number={10} name={name} rim="#fff0c4" />
      </Layer>
    ),
    near: (
      <Layer>
        <path d="M-30 -30H20L8 330H-30z" fill="#18271f" />
        <path d="M430 -30H380L392 330H430z" fill="#18271f" />
        <path d="M20 -30L8 330M380 -30L392 330" stroke="#9bb3a6" strokeWidth="0.8" opacity=".35" fill="none" />
        <rect x="-30" y="-30" width="460" height="360" fill="url(#pbs-vignette)" stroke="none" />
      </Layer>
    ),
  };
}

function Transfer({ name }: { name: string }): Layers {
  const towers: [number, number, number, string][] = [
    [18, 66, 118, "#7d97b8"],
    [72, 52, 150, "#8a6075"],
    [118, 64, 100, "#e4cfa3"],
    [212, 56, 132, "#6fa2ae"],
    [270, 66, 110, "#efe3c8"],
    [332, 62, 144, "#7d97b8"],
  ];
  const dash = (xb: number) => {
    const segs: string[] = [];
    for (let i = 0; i < 8; i++) {
      const t0 = Math.pow(i / 8, 1.7);
      const t1 = Math.pow((i + 0.5) / 8, 1.7);
      const p = (t: number): Pt => [lerp(200, xb, t), lerp(238, 330, t)];
      const [x0, y0] = p(t0);
      const [x1, y1] = p(t1);
      const w0 = 0.6 + 4 * t0;
      const w1 = 0.6 + 4 * t1;
      segs.push(`M${f1(x0 - w0)} ${f1(y0)}L${f1(x0 + w0)} ${f1(y0)}L${f1(x1 + w1)} ${f1(y1)}L${f1(x1 - w1)} ${f1(y1)}z`);
    }
    return segs.join("");
  };
  return {
    far: (
      <Layer>
        <Sky id="transfer" />
        <circle cx="96" cy="86" r="52" fill="url(#pbs-sun-glow)" opacity=".7" stroke="none" />
        <Streak x={60} y={64} w={100} o={0.6} />
        <Streak x={290} y={124} w={86} o={0.5} />
        <Streak x={190} y={40} w={60} o={0.4} />
        <path d="M40 128L252 66l1 9L46 139z" fill="url(#pbs-trail)" stroke="none" />
        <g transform="translate(300 60) rotate(-14)" strokeWidth="1.1">
          <path d="M-6-2L-34-26h12l22 22z" fill="#d9ceb8" />
          <path d="M-44-6l-7-15h10l12 15z" fill={CORAL} />
          <ellipse cx="0" cy="0" rx="46" ry="10.5" fill={CREAM} />
          <path d="M-8 6L-34 26h12L8 8z" fill="#d9ceb8" />
          <Shade d="M-40 2Q0 12 44 2Q40 10 0 11Q-36 10-40 2z" o={0.16} />
          <path d="M30-5h12M-30-3q38 6 72 2" fill="none" strokeWidth="0.8" />
          {[-20, -10, 0, 10, 20].map((cx) => (
            <rect key={cx} x={cx - 1.2} y="-4" width="2.4" height="3" rx="1" fill={INK} stroke="none" opacity=".75" />
          ))}
        </g>
        {[[-10, 70, 90, "#b6c8cc"], [58, 40, 116, "#a8bdc4"], [98, 50, 84, "#b6c8cc"], [150, 44, 104, "#a8bdc4"], [196, 56, 78, "#b6c8cc"], [250, 46, 112, "#a8bdc4"], [296, 54, 88, "#b6c8cc"], [352, 70, 100, "#a8bdc4"]].map(([x, w, h, c], i) => (
          <rect key={i} x={x as number} y={226 - (h as number)} width={w as number} height={h as number} fill={c as string} stroke="none" />
        ))}
        <rect x="-30" y="150" width="460" height="80" fill="url(#pbs-haze)" stroke="none" />
      </Layer>
    ),
    mid: (
      <Layer>
        {towers.map(([x, w, h, c], i) => (
          <g key={i}>
            <rect x={x} y={226 - h} width={w} height={h} fill={c} />
            <Shade d={`M${x + w * 0.62} ${226 - h}h${w * 0.38}v${h}h${-w * 0.38}z`} o={0.14} />
            {Array.from({ length: Math.floor(h / 24) }, (_, r) =>
              [0, 1, 2].slice(0, Math.floor(w / 20)).map((cc) => (
                <rect key={`${r}${cc}`} x={x + 8 + cc * 18} y={226 - h + 10 + r * 22} width="8" height="11" rx="1" fill={(r + cc + i) % 4 ? "#b7c9d0" : SUN_LT} strokeWidth="0.6" opacity={(r + cc + i) % 4 ? 0.8 : 0.95} />
              )),
            )}
            <rect x={x - 2} y={226 - h - 3} width={w + 4} height="4" fill={INK} opacity=".35" stroke="none" />
          </g>
        ))}
        <rect x="-30" y="226" width="460" height="20" fill="#d6c8a8" />
        <path d="M-30 246H430" strokeWidth="1.6" />
        <path d={Array.from({ length: 16 }, (_, i) => `M${-20 + i * 30} 226V246`).join("")} strokeWidth="0.5" opacity=".3" fill="none" />
        <rect x="-30" y="246" width="460" height="90" fill="#838f8d" stroke="none" />
        <Halftone d="M-30 246H430V262H-30z" o={0.4} />
        <path d={dash(10) + dash(390)} fill={CREAM} stroke="none" opacity=".85" />
        {/* arrow signpost */}
        <g transform="translate(40 0)">
          <path d="M52 262V198" strokeWidth="2.4" fill="none" />
          <path d="M26 198h54l11 12-11 12H26z" fill={CORAL} />
          <Shade d="M26 210h65l-11 12H26z" o={0.16} />
          <path d="M38 210h30m-8-7 8 7-8 7" fill="none" stroke={CREAM} strokeWidth="2.2" />
          <ellipse cx="52" cy="263" rx="9" ry="2.2" fill={SHADE} opacity=".22" stroke="none" />
        </g>
      </Layer>
    ),
    fig: (
      <Layer>
        <Figure x={196} y={292} s={1.34} kit="#4e72a3" trim={CREAM} shorts={CREAM} socks="#4e72a3" number={9} name={name} bag={CORAL} />
      </Layer>
    ),
    near: (
      <Layer>
        <path d="M366 330L368 66H374L376 330z" fill="#2f3b40" />
        <path d="M371 66Q371 44 342 44" fill="none" stroke="#2f3b40" strokeWidth="5" />
        <path d="M371 66Q371 44 342 44" fill="none" strokeWidth="1.2" opacity=".5" stroke="#9fb0b5" />
        <rect x="326" y="42" width="22" height="9" rx="3" fill="#2f3b40" />
        <rect x="329" y="49" width="16" height="3" fill="#f2dfa5" stroke="none" />
        <rect x="-30" y="-30" width="460" height="360" fill="url(#pbs-vignette)" stroke="none" />
      </Layer>
    ),
  };
}

function Trophies({ name }: { name: string }): Layers {
  const topY = (x: number) => {
    const t = (x + 30) / 460;
    return (1 - t) * (1 - t) * 214 + 2 * (1 - t) * t * 92 + t * t * 214;
  };
  const curve = (y0: number) => `M-30 ${y0}Q200 ${y0 - 122} 430 ${y0}`;
  const confetti = Array.from({ length: 16 }, (_, i) => ({
    x: (i * 53 + 17) % 400,
    y: 120 + ((i * 37 + 9) % 110),
    r: (i * 47) % 90,
    c: [CORAL, SUN, BLUE, CREAM, "#8a6075"][i % 5],
  }));
  return {
    far: (
      <Layer>
        <Sky id="trophies" />
        <path d="M60 80L30 262H130zM340 80L370 262H270z" fill="url(#pbs-beam)" stroke="none" />
        <Mast x={62} y={64} h={150} lit />
        <Mast x={338} y={64} h={150} lit />
        <path d={`${curve(206)}V252H-30z`} fill="url(#pbs-crowd)" />
        <path d={Array.from({ length: 6 }, (_, k) => curve(214 + k * 7)).join("")} fill="none" stroke={SHADE} strokeWidth="0.7" opacity=".35" />
        <path
          d={Array.from({ length: 13 }, (_, i) => {
            const x = -10 + i * 36;
            return `M${f1(lerp(x, 200 + (x - 200) * 1.06, 1))} 252L${f1(x)} ${f1(topY(x) + 12)}`;
          }).join("")}
          fill="none"
          stroke={SHADE}
          strokeWidth="1.1"
          opacity=".5"
        />
        <Shade d={`${curve(206)}V232Q200 ${206 - 122 + 26} -30 232z`} o={0.2} />
        <path d={`M-30 192Q200 70 430 192V204Q200 84 -30 204z`} fill="#463f52" />
        <path d={Array.from({ length: 24 }, (_, i) => {
          const x = -20 + i * 19;
          const y = topY(x) + 10;
          return `M${x} ${f1(y)}l9.5 -10l9.5 10`;
        }).join("")} fill="none" strokeWidth="0.5" opacity=".5" />
        {Array.from({ length: 20 }, (_, i) => (
          <rect key={i} x={-30 + i * 24} y={248} width="24" height="8" fill={[BLUE, CORAL, TEAL, SUN, "#7c6a8a", CREAM][i % 6]} strokeWidth="0.7" />
        ))}
        <rect x="-30" y="248" width="460" height="8" fill={SHADE} opacity=".18" stroke="none" />
      </Layer>
    ),
    mid: (
      <Layer>
        <Bands y0={256} y1={330} a={GRASS} b={GRASS_LT} n={4} grow={0.5} />
        <rect x="-30" y="256" width="460" height="22" fill="url(#pbs-haze)" opacity=".7" stroke="none" />
        {confetti.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width="7" height="3.4" fill={c.c} strokeWidth="0.7" opacity=".9" transform={`rotate(${c.r} ${c.x} ${c.y})`} />
        ))}
      </Layer>
    ),
    fig: (
      <Layer>
        <Figure x={200} y={296} s={1.28} kit="#b6433b" trim={CREAM} shorts={CREAM} socks="#b6433b" number={10} name={name} arms="up" />
      </Layer>
    ),
    near: (
      <Layer>
        {[[22, 40, 30], [366, 58, -24], [48, 92, 70], [346, 22, 110]].map(([x, y, r], i) => (
          <rect key={i} x={x} y={y} width="11" height="5" fill={[CORAL, SUN, CREAM, BLUE][i]} strokeWidth="0.8" opacity=".85" transform={`rotate(${r} ${x} ${y})`} />
        ))}
        <rect x="-30" y="-30" width="460" height="360" fill="url(#pbs-vignette)" stroke="none" />
      </Layer>
    ),
  };
}

function Legend({ name }: { name: string }): Layers {
  return {
    far: (
      <Layer>
        <Sky id="legend" />
        <circle cx="244" cy="150" r="92" fill="url(#pbs-sun-glow)" stroke="none" />
        <circle cx="244" cy="150" r="30" fill="#fbe7b0" stroke="none" />
        <Streak x={40} y={96} w={130} o={0.45} c="#f6d8a8" />
        <Streak x={270} y={80} w={110} o={0.4} c="#f6d8a8" />
        <Streak x={150} y={128} w={90} o={0.35} c="#f6d8a8" />
      </Layer>
    ),
    mid: (
      <Layer>
        <path d="M-30 168H430V214H-30z" fill="url(#pbs-seats)" />
        <path d={Array.from({ length: 9 }, (_, i) => `M-30 ${170 + i * 5}H430`).join("")} stroke={SHADE} strokeWidth="0.7" opacity=".35" fill="none" />
        <path d={Array.from({ length: 18 }, (_, i) => `M${-20 + i * 26} 168V214`).join("")} stroke={SHADE} strokeWidth="1" opacity=".4" fill="none" />
        <path d="M-30 164H430V170H-30z" fill="#3b2a3b" />
        <path d="M-30 150L90 160H310L430 150V164H-30z" fill="#3b2a3b" />
        <path d={Array.from({ length: 20 }, (_, i) => `M${-20 + i * 24} 164l12 -10l12 10`).join("")} fill="none" strokeWidth="0.5" opacity=".5" />
        <Mast x={70} y={72} h={96} lit />
        <Mast x={330} y={72} h={96} lit />
        <rect x="-30" y="214" width="460" height="7" fill="#5d4560" />
        <Bands y0={221} y1={330} a={GRASS_DK} b={GRASS} n={6} grow={0.45} />
        <rect x="-30" y="221" width="460" height="46" fill="url(#pbs-warm-pitch)" stroke="none" />
        <path d="M-10 255H410" stroke={CREAM} strokeWidth="1" opacity=".55" fill="none" />
        <ellipse cx="200" cy="255" rx="104" ry="20" fill="none" stroke={CREAM} strokeWidth="1" opacity=".55" />
        <g transform="translate(352 226)" strokeWidth="0.9">
          <path d="M0 0V-18" fill="none" />
          <path d="M0-18l9 3-9 4z" fill={SUN} />
        </g>
      </Layer>
    ),
    fig: (
      <Layer>
        <Figure x={190} y={292} s={1.3} kit="#8a3a48" trim={CREAM} shorts={CREAM} socks="#8a3a48" number={10} name={name} hair="#b9b3a8" age="veteran" />
        <Ball x={248} y={284} r={8.5} />
      </Layer>
    ),
    near: (
      <Layer>
        <rect x="-30" y="-30" width="460" height="360" fill="url(#pbs-warm-grade)" stroke="none" />
        <path d="M-6 330Q0 306 8 296M2 330Q8 310 20 302M14 330Q18 314 30 308M420 330Q414 306 406 296M412 330Q404 312 392 304M398 330Q396 316 384 310" fill="none" stroke="#1f3d2f" strokeWidth="1.6" opacity=".75" />
        <rect x="-30" y="-30" width="460" height="360" fill="url(#pbs-vignette)" stroke="none" />
      </Layer>
    ),
  };
}

const SCENE_RENDERERS: Record<string, (p: { name: string }) => Layers> = {
  academy: Academy,
  debut: Debut,
  transfer: Transfer,
  trophies: Trophies,
  legend: Legend,
};

/**
 * Hidden sprite sheet: every scene layer is defined once and referenced with <use> by the stage and the five panels,
 * so the artwork is only in the DOM a single time. Must stay at non-zero DOM presence (not display:none) for the
 * gradients and patterns to resolve.
 */
export function SceneSprites({ name }: { name: string }) {
  return (
    <svg width="0" height="0" aria-hidden focusable="false" style={{ position: "absolute" }}>
      <defs>
        <pattern id="pbs-ht" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="1.7" cy="1.7" r="0.72" fill={SHADE} opacity=".5" />
        </pattern>
        <pattern id="pbs-crowd" width="12" height="8" patternUnits="userSpaceOnUse">
          <rect width="12" height="8" fill="#3a3546" />
          <circle cx="2.4" cy="2.2" r="1.3" fill={CORAL} opacity=".5" />
          <circle cx="8.4" cy="2.2" r="1.3" fill={SUN} opacity=".48" />
          <circle cx="5.4" cy="6" r="1.3" fill={CREAM} opacity=".36" />
          <circle cx="11" cy="6" r="1.3" fill={TEAL} opacity=".42" />
        </pattern>
        <pattern id="pbs-seats" width="9" height="5" patternUnits="userSpaceOnUse">
          <rect width="9" height="5" fill="#5b4260" />
          <rect x="1.2" y="1" width="5" height="2.6" rx="1" fill="#7b5a7c" />
        </pattern>
        <linearGradient id="pbs-sky-academy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b6d1cf" />
          <stop offset=".6" stopColor="#e8dcb9" />
          <stop offset="1" stopColor="#f1d9a8" />
        </linearGradient>
        <linearGradient id="pbs-sky-debut" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fb2c4" />
          <stop offset=".5" stopColor="#c9d7d2" />
          <stop offset="1" stopColor="#e4e0c8" />
        </linearGradient>
        <linearGradient id="pbs-sky-transfer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9bc2d2" />
          <stop offset=".7" stopColor="#d5e1da" />
          <stop offset="1" stopColor="#efe2c2" />
        </linearGradient>
        <linearGradient id="pbs-sky-trophies" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5d5470" />
          <stop offset=".45" stopColor="#b98a66" />
          <stop offset="1" stopColor="#ecc78a" />
        </linearGradient>
        <linearGradient id="pbs-sky-legend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bd8272" />
          <stop offset=".5" stopColor="#e2a273" />
          <stop offset="1" stopColor="#f2cf98" />
        </linearGradient>
        <radialGradient id="pbs-sun-glow">
          <stop offset="0" stopColor="#fff1c4" stopOpacity=".75" />
          <stop offset="1" stopColor="#fff1c4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pbs-glow">
          <stop offset="0" stopColor="#fff3cc" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff3cc" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pbs-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6ecd2" stopOpacity=".55" />
          <stop offset="1" stopColor="#f6ecd2" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pbs-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3cc" stopOpacity=".28" />
          <stop offset="1" stopColor="#fff3cc" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pbs-trail" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity=".75" />
        </linearGradient>
        <linearGradient id="pbs-spill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5e6b4" stopOpacity=".5" />
          <stop offset="1" stopColor="#f5e6b4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pbs-warm-pitch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5c47c" stopOpacity=".32" />
          <stop offset="1" stopColor="#f5c47c" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pbs-warm-grade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8946a" stopOpacity="0" />
          <stop offset="1" stopColor="#c9663f" stopOpacity=".2" />
        </linearGradient>
        <radialGradient id="pbs-vignette" cx=".5" cy=".5" r=".75">
          <stop offset=".55" stopColor="#14130f" stopOpacity="0" />
          <stop offset="1" stopColor="#14130f" stopOpacity=".34" />
        </radialGradient>
        {SCENES.map((sc) => {
          const layers = SCENE_RENDERERS[sc.key]({ name });
          return LAYERS.map((l) => (
            <g key={`${sc.key}-${l}`} id={`pbs-${sc.key}-${l}`}>
              {layers[l]}
            </g>
          ));
        })}
      </defs>
    </svg>
  );
}

/** Small stadium vignette for the career-arc card. Standalone (own ids), same line, palette and shading. */
export function StadiumArt({ className = "" }: { className?: string }) {
  const stripes = Array.from({ length: 7 }, (_, i) => {
    const y0 = 84 + (i * i * 66) / 49 + i * 4;
    const y1 = 84 + (((i + 1) * (i + 1)) * 66) / 49 + (i + 1) * 4;
    return { y0, y1 };
  });
  return (
    <svg viewBox="0 0 300 150" className={className} aria-hidden focusable="false" strokeLinejoin="round" strokeLinecap="round" stroke={INK} strokeWidth="1.1">
      <defs>
        <clipPath id="pbs-arc-pitch">
          <path d="M62 89H238L304 150H-4z" />
        </clipPath>
        <clipPath id="pbs-arc-clip">
          <rect width="300" height="150" rx="14" />
        </clipPath>
        <linearGradient id="pbs-arc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9c9cf" />
          <stop offset="1" stopColor="#efe0bd" />
        </linearGradient>
        <radialGradient id="pbs-arc-glow">
          <stop offset="0" stopColor="#fff1c4" stopOpacity=".8" />
          <stop offset="1" stopColor="#fff1c4" stopOpacity="0" />
        </radialGradient>
        <pattern id="pbs-arc-crowd" width="10" height="7" patternUnits="userSpaceOnUse">
          <rect width="10" height="7" fill="#3a3546" />
          <circle cx="2" cy="1.9" r="1.2" fill={CORAL} opacity=".5" />
          <circle cx="7" cy="1.9" r="1.2" fill={SUN} opacity=".48" />
          <circle cx="4.5" cy="5.2" r="1.2" fill={CREAM} opacity=".36" />
          <circle cx="9.4" cy="5.2" r="1.2" fill={TEAL} opacity=".42" />
        </pattern>
        <pattern id="pbs-arc-ht" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="1.7" cy="1.7" r="0.7" fill={SHADE} opacity=".5" />
        </pattern>
      </defs>
      <g clipPath="url(#pbs-arc-clip)">
        <rect width="300" height="150" fill="url(#pbs-arc-sky)" stroke="none" />
        <circle cx="46" cy="40" r="34" fill="url(#pbs-arc-glow)" stroke="none" />
        <circle cx="46" cy="40" r="10" fill="#f7e6b6" stroke="none" />
        <path d="M-4 66Q50 40 110 58T230 52T304 62V90H-4z" fill="#9db9ab" stroke="none" />
        <path d="M232 26q10-4 20-1 8-3 16 1-10 4-20 3-8 2-16-3z" fill={CREAM} opacity=".6" stroke="none" />
        {/* far stand + roof */}
        <rect x="62" y="46" width="176" height="38" fill="url(#pbs-arc-crowd)" />
        <path d={Array.from({ length: 7 }, (_, i) => `M62 ${52 + i * 5}H238`).join("")} stroke={SHADE} strokeWidth="0.5" opacity=".35" fill="none" />
        <path d={Array.from({ length: 9 }, (_, i) => `M${72 + i * 19} 46V84`).join("")} stroke={SHADE} strokeWidth="0.8" opacity=".5" fill="none" />
        <rect x="62" y="46" width="176" height="8" fill={SHADE} opacity=".25" stroke="none" />
        <path d="M54 40H246L240 48H60z" fill="#4c5560" />
        <path d={Array.from({ length: 14 }, (_, i) => `M${62 + i * 13} 48l6.5-8 6.5 8`).join("")} fill="none" strokeWidth="0.5" opacity=".55" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={62 + i * 22} y="84" width="22" height="5" fill={[BLUE, CORAL, TEAL, SUN][i % 4]} strokeWidth="0.6" />
        ))}
        {/* side stands in perspective */}
        <path d="M62 46L-4 76V150L62 89z" fill="url(#pbs-arc-crowd)" />
        <path d="M238 46L304 76V150L238 89z" fill="url(#pbs-arc-crowd)" />
        <path d={Array.from({ length: 6 }, (_, k) => `M62 ${46 + (k + 1) * 7.2}L-4 ${76 + (k + 1) * 12.3}M238 ${46 + (k + 1) * 7.2}L304 ${76 + (k + 1) * 12.3}`).join("")} stroke={SHADE} strokeWidth="0.5" opacity=".35" fill="none" />
        <path d="M-4 76L62 46V89L-4 150z" fill={SHADE} opacity=".15" stroke="none" />
        <path d="M54 40L-4 68V76L62 46zM246 40L304 68V76L238 46z" fill="#4c5560" />
        {/* pitch */}
        <path d="M62 89H238L304 150H-4z" fill={GRASS} />
        <g clipPath="url(#pbs-arc-pitch)">
        {stripes.map((s, i) => (i % 2 ? <rect key={i} x="-4" y={f1(s.y0)} width="308" height={f1(s.y1 - s.y0 + 0.5)} fill={GRASS_LT} stroke="none" opacity=".9" /> : null))}
        </g>
        <path d="M62 89H238L304 150H-4z" fill="none" />
        <path d="M118 90L106 104H194L182 90M134 90L128 96H172L166 90" fill="none" stroke={CREAM} strokeWidth="0.9" opacity=".85" />
        <path d="M18 128H282" stroke={CREAM} strokeWidth="0.9" opacity=".7" fill="none" />
        <ellipse cx="150" cy="128" rx="44" ry="9" fill="none" stroke={CREAM} strokeWidth="0.9" opacity=".8" />
        <path d="M62 89L-4 150M238 89L304 150" fill="none" stroke={CREAM} strokeWidth="0.9" opacity=".7" />
        <path d="M-4 150L62 89V92L0 150z" fill={SHADE} opacity=".12" stroke="none" />
        {/* masts + pennant */}
        {[[30, 18], [270, 18]].map(([mx, my]) => (
          <g key={mx} strokeWidth="0.8">
            <path d={`M${mx - 3} ${my + 58}L${mx - 1.2} ${my + 10}H${mx + 1.2}L${mx + 3} ${my + 58}`} fill="#8e9a9d" />
            <rect x={mx - 10} y={my} width="20" height="11" rx="1.4" fill="#5a676d" />
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <circle cx={mx - 7 + i * 4.7} cy={my + 3.4} r="1.4" fill={CREAM} stroke="none" />
                <circle cx={mx - 7 + i * 4.7} cy={my + 7.6} r="1.4" fill={CREAM} stroke="none" />
              </g>
            ))}
          </g>
        ))}
        <path d="M150 40V22" strokeWidth="1" fill="none" />
        <path d="M150 22l14 4-14 5z" fill={CORAL} strokeWidth="0.9" />
        <Halftone d="M238 89L304 150H250z" o={0.5} />
      </g>
      <rect x="1" y="1" width="298" height="148" rx="13" fill="none" />
    </svg>
  );
}
