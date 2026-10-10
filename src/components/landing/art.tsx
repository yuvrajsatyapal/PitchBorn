import type { ReactNode } from "react";

/**
 * Original flat-vector career illustrations for the landing page. Every scene is drawn in a 400x300 box with the
 * same ink outline, palette and back-view figure so the hero and its five career-moment panels read as one set.
 * Fixed colours on purpose (like Crest/Kit): the artwork must not invert with the dark theme.
 */
export const INK = "#1b1712";
const CREAM = "#fff5e6";
const SUN = "#ffc62b";
const CORAL = "#ff6b57";
const GRASS = "#2e8b57";
const GRASS_LT = "#3f9d66";
const GRASS_DK = "#256f47";
const SKIN = "#d9a074";
const GOLD_HI = "#fff0a8";

export interface SceneDef {
  key: string;
  label: string;
  caption: string;
  /** viewBox for the small panel crop (aspect ≈ 1.87) */
  thumb: string;
}

export const SCENES: SceneDef[] = [
  { key: "academy", label: "Academy", caption: "A young player walks through the academy gates.", thumb: "70 92 260 139" },
  { key: "debut", label: "Debut", caption: "A first professional appearance, seen from the tunnel.", thumb: "60 78 280 150" },
  { key: "transfer", label: "Transfer", caption: "A big move to a new club, bag in hand.", thumb: "70 100 260 139" },
  { key: "trophies", label: "Trophies", caption: "A championship trophy lifted high.", thumb: "70 62 260 139" },
  { key: "legend", label: "Legend", caption: "A veteran's last walk at sunset.", thumb: "60 90 280 150" },
];

const f1 = (n: number) => n.toFixed(1);

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
  arms?: "down" | "up";
  kid?: boolean;
}

/** A footballer seen from behind. Origin is the centre of the feet; the figure is ~115 units tall. */
function Figure({ x, y, s = 1, kit, trim, shorts, socks, number, name, hair = "#4a2c1a", arms = "down", kid = false }: FigureProps) {
  const sw = 2.4 / s;
  const nameLen = Math.min(30, Math.max(14, name.length * 4.4));
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={INK} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
      <ellipse cx="0" cy="1" rx="27" ry="5" fill="#000" opacity=".16" stroke="none" />
      {/* legs, socks, boots */}
      <path d="M-14 -27h10v21h-10z M4 -27h10v21h-10z" fill={SKIN} />
      <path d="M-14 -19h10v14h-10z M4 -19h10v14h-10z" fill={socks} />
      <path d="M-14 -14h10 M4 -14h10" stroke={trim} strokeWidth={sw * 1.2} />
      <path d="M-15 -6h12l1 5q0 3-3 3h-8q-3 0-3-3z M3 -6h12l1 5q0 3-3 3h-8q-3 0-3-3z" fill={INK} />
      <path d="M-17 -48h34l2 24h-17l-2-9-2 9h-17z" fill={shorts} />
      {/* neck + head */}
      <path d="M-4.5 -97h9v8h-9z" fill={SKIN} />
      {/* torso */}
      <path d="M-17 -49l-5-31q0-8 9-10h26q9 2 9 10l-5 31z" fill={kit} />
      <path d="M-7 -90q7 6 14 0" fill={trim} />
      {arms === "down" ? (
        <>
          <path d="M-22 -82l-9 14 7 5 7-11z M22 -82l9 14-7 5-7-11z" fill={kit} />
          <path d="M-31 -68l-2 21q2 4 6 0l3-16z M31 -68l2 21q-2 4-6 0l-3-16z" fill={SKIN} />
          <path d="M-30 -70l7 5 M30 -70l-7 5" stroke={trim} strokeWidth={sw * 1.5} />
        </>
      ) : (
        <>
          <path d="M-19 -84L-28 -103-13 -123M19 -84L28 -103 13 -123" fill="none" stroke={INK} strokeWidth={11.5} />
          <path d="M-19 -84L-28 -103-13 -123M19 -84L28 -103 13 -123" fill="none" stroke={SKIN} strokeWidth={7.6} />
          <path d="M-19 -84L-24 -94M19 -84L24 -94" fill="none" stroke={INK} strokeWidth={13.5} />
          <path d="M-19 -84L-24 -94M19 -84L24 -94" fill="none" stroke={kit} strokeWidth={10} />
        </>
      )}
      <g transform={kid ? "translate(0 -103) scale(1.12) translate(0 103)" : undefined}>
        <circle cx="-10.5" cy="-102" r="2.9" fill={SKIN} />
        <circle cx="10.5" cy="-102" r="2.9" fill={SKIN} />
        <ellipse cx="0" cy="-103" rx="10.5" ry="11.5" fill={SKIN} />
        <path d="M-11.4 -102C-12-118 12-118 11.4-102 10.5-96 6-93.6 0-93.6S-10.5-96-11.4-102z" fill={hair} />
        <path d="M-3 -110q4 3 7 0" fill="none" strokeWidth={sw * 0.7} opacity=".5" />
      </g>
      <text x="0" y="-77" textAnchor="middle" fontSize="7" fontFamily="var(--font-lilita), sans-serif" fill={trim} stroke="none" textLength={nameLen} lengthAdjust="spacingAndGlyphs">
        {name}
      </text>
      <text x="0" y="-57" textAnchor="middle" fontSize="23" fontFamily="var(--font-lilita), sans-serif" fill={trim} stroke="none">
        {number}
      </text>
    </g>
  );
}

function Trophy({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={INK} strokeWidth={2.2 / s} strokeLinejoin="round">
      <path d="M-11 -34q-12 0-12 9t12 12M11 -34q12 0 12 9T11-13" fill="none" strokeWidth={3 / s} />
      <path d="M-12 -40h24q0 22-8 28-2 2-4 2t-4-2q-8-6-8-28z" fill={SUN} />
      <path d="M-7 -37q0 16 3 22" fill="none" stroke={GOLD_HI} strokeWidth={2.4 / s} />
      <path d="M-3 -10h6v7h-6z" fill={SUN} />
      <path d="M-10 -3h20v6h-20z" fill="#e09a10" />
    </g>
  );
}

function Floodlight({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g stroke={INK} strokeWidth="2" strokeLinejoin="round">
      <path d={`M${x - 2} ${y}h4v${h}h-4z`} fill="#3a4a58" />
      <rect x={x - 14} y={y - 15} width="28" height="17" rx="2" fill="#4a5a68" />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={x - 9 + i * 6} cy={y - 10} r="2.1" fill={CREAM} stroke="none" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={x - 9 + i * 6} cy={y - 4} r="2.1" fill={CREAM} stroke="none" />
      ))}
    </g>
  );
}

function Bands({ y0, y1, a, b, n = 6, grow = 0.32 }: { y0: number; y1: number; a: string; b: string; n?: number; grow?: number }) {
  const weights = Array.from({ length: n }, (_, i) => 1 + i * grow);
  const total = weights.reduce((acc, w) => acc + w, 0);
  let y = y0;
  return (
    <>
      {weights.map((w, i) => {
        const h = ((y1 - y0) * w) / total;
        const el = <rect key={i} x="0" y={f1(y)} width="400" height={f1(h + 0.5)} fill={i % 2 ? b : a} />;
        y += h;
        return el;
      })}
    </>
  );
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={CREAM} stroke={INK} strokeWidth={2 / s}>
      <path d="M-26 8q-10 0-10-8t10-8q2-10 14-10 9 0 12 8 12-2 14 8 2 10-10 10z" />
    </g>
  );
}

/* ───────────────────────── scenes (400x300) ───────────────────────── */

function Academy({ name }: { name: string }) {
  return (
    <g strokeLinejoin="round" stroke={INK} strokeWidth="3">
      <rect width="400" height="300" fill="#ffe3a8" stroke="none" />
      <circle cx="322" cy="112" r="32" fill={SUN} />
      <Cloud x={92} y={86} s={0.9} />
      <circle cx="58" cy="142" r="34" fill={GRASS_LT} />
      <circle cx="104" cy="152" r="26" fill={GRASS} />
      <circle cx="348" cy="150" r="30" fill={GRASS_LT} />
      <rect x="-4" y="150" width="408" height="72" fill="#e8b98d" />
      <path d="M0 170H400M0 190H400M0 208H400" stroke="#c9956b" strokeWidth="1.6" />
      <path d="M138 222V178Q138 138 200 138t62 40v44z" fill="#244f3c" />
      <path d="M149 222V180Q149 150 200 150t51 30v42z" fill={GRASS_LT} strokeWidth="2" />
      <path d="M149 196H251M149 210H251" stroke={GRASS} strokeWidth="6" />
      <path d="M176 128v12M224 128v12" strokeWidth="2.5" />
      <rect x="160" y="106" width="80" height="24" rx="4" fill={CREAM} />
      <text x="200" y="124" textAnchor="middle" fontSize="14" fontFamily="var(--font-lilita), sans-serif" fill={INK} stroke="none" textLength="62" lengthAdjust="spacingAndGlyphs">
        ACADEMY
      </text>
      <rect x="-4" y="222" width="408" height="84" fill={GRASS_LT} />
      <path d="M168 222h64l62 80H106z" fill="#ead3a8" strokeWidth="2.5" />
      <path d="M62 262l11-22 11 22zM92 274l11-22 11 22z" fill={CORAL} strokeWidth="2.4" />
      <circle cx="326" cy="266" r="10" fill={CREAM} strokeWidth="2.4" />
      <path d="M326 261l5 4-2 6h-6l-2-6z" fill={INK} stroke="none" />
      <Figure x={196} y={280} s={1.04} kit="#8fc7ee" trim={INK} shorts={CREAM} socks="#8fc7ee" number={17} name={name} kid />
      <rect x="226" y="248" width="26" height="18" rx="5" fill={CORAL} strokeWidth="2.4" />
      <path d="M232 248q6-9 14 0" fill="none" strokeWidth="2.4" />
    </g>
  );
}

function Debut({ name }: { name: string }) {
  return (
    <g strokeLinejoin="round" stroke={INK} strokeWidth="3">
      <rect width="400" height="300" fill="#0f2119" stroke="none" />
      <clipPath id="pbs-clip-opening">
        <rect x="100" y="56" width="200" height="150" />
      </clipPath>
      <g clipPath="url(#pbs-clip-opening)" stroke="none">
        <rect x="100" y="56" width="200" height="150" fill="#7fc4e0" />
        <rect x="100" y="56" width="200" height="12" fill="#3a4a58" />
        <rect x="100" y="68" width="200" height="66" fill="url(#pbs-crowd-b)" />
        <rect x="100" y="130" width="200" height="6" fill="#2f3f5a" />
        <Bands y0={136} y1={206} a={GRASS} b={GRASS_LT} n={5} />
        <path d="M130 206l24-70h92l24 70" fill="none" stroke={CREAM} strokeWidth="2" opacity=".85" />
        <ellipse cx="200" cy="176" rx="34" ry="9" fill="none" stroke={CREAM} strokeWidth="2" opacity=".85" />
        <Floodlight x={120} y={76} h={60} />
        <Floodlight x={280} y={76} h={60} />
      </g>
      <path d="M0 0L100 56V206L0 300z" fill="#1d3a2f" />
      <path d="M400 0L300 56V206L400 300z" fill="#1d3a2f" />
      <path d="M0 0H400L300 56H100z" fill="#14291f" />
      <path d="M0 300L100 206H300L400 300z" fill="#2d5a47" />
      <path d="M0 110L100 131M0 200L100 168M400 110L300 131M400 200L300 168" stroke="#2f5c49" strokeWidth="2" fill="none" />
      <path d="M0 36L100 94M400 36L300 94" stroke={SUN} strokeWidth="3" fill="none" opacity=".9" />
      <path d="M100 206L300 206L372 300H28z" fill="#3b6c56" stroke="none" />
      <path d="M150 206L110 300M250 206L290 300" stroke="#27493a" strokeWidth="2" fill="none" />
      <Figure x={200} y={284} s={1.42} kit="#d9cfc0" trim={INK} shorts={INK} socks="#d9cfc0" number={10} name={name} />
    </g>
  );
}

function Transfer({ name }: { name: string }) {
  const towers: [number, number, number, string][] = [
    [22, 70, 120, "#7fa7e8"],
    [78, 52, 150, "#913a7f"],
    [126, 66, 104, "#f2d29a"],
    [210, 56, 134, "#6fb3d4"],
    [270, 70, 112, "#fff5e6"],
    [334, 60, 146, "#7fa7e8"],
  ];
  return (
    <g strokeLinejoin="round" stroke={INK} strokeWidth="3">
      <rect width="400" height="300" fill="#9fd3e6" stroke="none" />
      <Cloud x={92} y={62} s={1} />
      <Cloud x={338} y={118} s={0.8} />
      {/* contrail + plane */}
      <path d="M62 150L214 92l6 12L74 162z" fill={CREAM} strokeWidth="0" opacity=".9" />
      <g transform="translate(284 82) rotate(-14)">
        <path d="M-6 -2L-34 -28h14l24 24z" fill="#e8dcc8" strokeWidth="2.6" />
        <path d="M-44 -6l-8-16h12l14 16z" fill={CORAL} strokeWidth="2.6" />
        <ellipse cx="0" cy="0" rx="46" ry="11" fill={CREAM} strokeWidth="2.8" />
        <path d="M-8 6L-34 28h14L8 8z" fill="#e8dcc8" strokeWidth="2.6" />
        <path d="M30 -5h12M-30 -3q38 6 72 2" fill="none" strokeWidth="2" />
        {[-20, -10, 0, 10, 20].map((cx) => (
          <circle key={cx} cx={cx} cy="-2" r="2" fill={INK} stroke="none" />
        ))}
      </g>
      {towers.map(([x, w, h, c], i) => (
        <g key={i}>
          <rect x={x} y={222 - h} width={w} height={h} fill={c} />
          {Array.from({ length: Math.floor(h / 26) }, (_, r) =>
            [0, 1, 2].slice(0, Math.floor(w / 22)).map((cc) => (
              <rect key={`${r}${cc}`} x={x + 9 + cc * 20} y={222 - h + 10 + r * 24} width="9" height="11" rx="1.5" fill={(r + cc + i) % 3 ? CREAM : SUN} strokeWidth="1.6" />
            )),
          )}
        </g>
      ))}
      <rect x="-4" y="222" width="408" height="84" fill="#cdbf9f" />
      <path d="M0 262H400" stroke={CREAM} strokeWidth="4" strokeDasharray="22 16" />
      {/* arrow signpost */}
      <g transform="translate(46 0)">
        <path d="M52 276V196" strokeWidth="4" />
        <path d="M24 196h58l12 13-12 13H24z" fill={CORAL} />
        <path d="M38 209h34m-9-8 9 8-9 8" fill="none" stroke={CREAM} strokeWidth="3.6" />
      </g>
      <Figure x={196} y={286} s={1.34} kit="#4d7fe8" trim={CREAM} shorts={CREAM} socks="#4d7fe8" number={9} name={name} />
      {/* duffel bag */}
      <path d="M236 244q8-14 20 0" fill="none" strokeWidth="3" />
      <rect x="230" y="244" width="40" height="24" rx="9" fill={CORAL} />
      <path d="M232 256h36" stroke={CREAM} strokeWidth="3" />
    </g>
  );
}

function Trophies({ name }: { name: string }) {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a0 = (i * 2 * Math.PI) / 16;
    const a1 = a0 + Math.PI / 16;
    return `M200 150L${f1(200 + 460 * Math.cos(a0))} ${f1(150 + 460 * Math.sin(a0))}L${f1(200 + 460 * Math.cos(a1))} ${f1(150 + 460 * Math.sin(a1))}z`;
  });
  const confetti = Array.from({ length: 38 }, (_, i) => ({
    x: (i * 53 + 17) % 400,
    y: (i * 37 + 9) % 200,
    r: (i * 47) % 90,
    c: [CORAL, SUN, "#4d7fe8", CREAM, "#913a7f"][i % 5],
  }));
  return (
    <g strokeLinejoin="round" stroke={INK} strokeWidth="3">
      <rect width="400" height="300" fill="#ffc86a" stroke="none" />
      {rays.map((d, i) => (i % 2 ? <path key={i} d={d} fill="#ffe3a8" stroke="none" /> : null))}
      <path d="M-4 168Q200 96 404 168V236H-4z" fill="#3b2140" />
      <path d="M-4 168Q200 96 404 168V210Q200 142 -4 210z" fill="url(#pbs-crowd-a)" stroke="none" />
      <path d="M-4 168Q200 96 404 168" fill="none" />
      <Floodlight x={94} y={104} h={70} />
      <Floodlight x={306} y={104} h={70} />
      <rect x="-4" y="226" width="408" height="80" fill={GRASS} />
      <Bands y0={226} y1={304} a={GRASS} b={GRASS_LT} n={4} />
      <path d="M-4 226H404" />
      {confetti.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width="8" height="4" fill={c.c} strokeWidth="1.4" transform={`rotate(${c.r} ${c.x} ${c.y})`} />
      ))}
      <Figure x={200} y={288} s={1.32} kit="#d6392f" trim={CREAM} shorts={CREAM} socks="#d6392f" number={10} name={name} arms="up" />
      <Trophy x={200} y={126} s={1.15} />
    </g>
  );
}

function Legend({ name }: { name: string }) {
  return (
    <g strokeLinejoin="round" stroke={INK} strokeWidth="3">
      <rect width="400" height="300" fill="#ff9a62" stroke="none" />
      <rect y="86" width="400" height="60" fill="#ffb97a" stroke="none" />
      <rect y="146" width="400" height="70" fill="#ffd89a" stroke="none" />
      <circle cx="200" cy="170" r="58" fill="#ffe9a8" />
      <path d="M-4 210L36 150H364l40 60v14H-4z" fill="#5a2a52" />
      <path d="M48 162H352M40 174H360M30 186H370M18 198H382" stroke="#7a3d6e" strokeWidth="2" fill="none" />
      <Floodlight x={92} y={118} h={32} />
      <Floodlight x={308} y={118} h={32} />
      <rect x="-4" y="216" width="408" height="90" fill={GRASS_DK} />
      <Bands y0={216} y1={304} a={GRASS_DK} b={GRASS} n={5} />
      <path d="M-4 216H404" />
      <ellipse cx="200" cy="262" rx="120" ry="22" fill="none" stroke={CREAM} strokeWidth="2.4" opacity=".8" />
      <path d="M206 288L330 300 282 304 190 292z" fill="#000" opacity=".16" stroke="none" />
      <Figure x={196} y={286} s={1.32} kit="#8f2d3f" trim={CREAM} shorts={CREAM} socks="#8f2d3f" number={10} name={name} hair="#b8b0a4" />
      <circle cx="232" cy="284" r="9" fill={CREAM} strokeWidth="2.4" />
      <path d="M232 279l5 4-2 6h-6l-2-6z" fill={INK} stroke="none" />
    </g>
  );
}

const SCENE_RENDERERS: Record<string, (p: { name: string }) => ReactNode> = {
  academy: Academy,
  debut: Debut,
  transfer: Transfer,
  trophies: Trophies,
  legend: Legend,
};

/**
 * Hidden sprite sheet: each scene is defined once and referenced with <use> by the stage and the five panels, so the
 * artwork is only in the DOM a single time. Must stay at non-zero DOM presence (not display:none) for patterns to resolve.
 */
export function SceneSprites({ name }: { name: string }) {
  return (
    <svg width="0" height="0" aria-hidden focusable="false" style={{ position: "absolute" }}>
      <defs>
        <pattern id="pbs-crowd-a" width="14" height="10" patternUnits="userSpaceOnUse">
          <rect width="14" height="10" fill="#3b2140" />
          <circle cx="3" cy="2.6" r="2" fill={CORAL} />
          <circle cx="10" cy="2.6" r="2" fill={SUN} />
          <circle cx="6.5" cy="7.6" r="2" fill={CREAM} />
        </pattern>
        <pattern id="pbs-crowd-b" width="12" height="9" patternUnits="userSpaceOnUse">
          <rect width="12" height="9" fill="#2f3f5a" />
          <circle cx="3" cy="2.4" r="1.8" fill={CREAM} />
          <circle cx="9" cy="2.4" r="1.8" fill={SUN} />
          <circle cx="6" cy="6.8" r="1.8" fill={CORAL} />
        </pattern>
        {SCENES.map((sc) => {
          const Render = SCENE_RENDERERS[sc.key];
          return (
            <g key={sc.key} id={`pbs-${sc.key}`}>
              <Render name={name} />
            </g>
          );
        })}
      </defs>
    </svg>
  );
}

/** Small stadium vignette for the career-arc card. Standalone (own ids), same outline + palette. */
export function StadiumArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 150" className={className} aria-hidden focusable="false" strokeLinejoin="round" stroke={INK} strokeWidth="3">
      <defs>
        <clipPath id="pbs-arc-clip">
          <rect width="300" height="150" rx="14" />
        </clipPath>
        <pattern id="pbs-arc-crowd" width="12" height="9" patternUnits="userSpaceOnUse">
          <rect width="12" height="9" fill="#3b2140" />
          <circle cx="3" cy="2.4" r="1.8" fill={CORAL} />
          <circle cx="9" cy="2.4" r="1.8" fill={SUN} />
          <circle cx="6" cy="6.8" r="1.8" fill={CREAM} />
        </pattern>
      </defs>
      <g clipPath="url(#pbs-arc-clip)">
        <rect width="300" height="150" fill="#bfe3ee" stroke="none" />
        <Cloud x={226} y={30} s={0.7} />
        <circle cx="48" cy="44" r="16" fill={SUN} />
        <path d="M-4 96L40 62H260l44 34v14H-4z" fill="#3b2140" />
        <path d="M30 78H270M18 88H282" stroke="url(#pbs-arc-crowd)" strokeWidth="8" fill="none" />
        <path d="M-4 96L40 62H260l44 34" fill="none" />
        <Floodlight x={36} y={38} h={34} />
        <Floodlight x={264} y={38} h={34} />
        <path d="M150 62V30" strokeWidth="2.6" />
        <path d="M150 30l30 8-30 8z" fill={CORAL} strokeWidth="2.6" />
        <rect x="-4" y="108" width="308" height="46" fill={GRASS} />
        <Bands y0={108} y1={152} a={GRASS} b={GRASS_LT} n={3} />
        <path d="M-4 108H304" />
        <ellipse cx="150" cy="130" rx="46" ry="9" fill="none" stroke={CREAM} strokeWidth="2.4" />
      </g>
      <rect x="1.5" y="1.5" width="297" height="147" rx="13" fill="none" />
    </svg>
  );
}
