/** Retro line icons for the feature cards: 2.5px ink strokes, one accent fill, same rounded joins as the rest of the UI. */
const common = { viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" } as const;

export function GlobeIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="24" cy="24" r="17" fill="var(--sun)" />
      <ellipse cx="24" cy="24" rx="7.5" ry="17" />
      <path d="M7 24h34M10 14.5q14 5 28 0M10 33.5q14-5 28 0M24 7v34" />
    </svg>
  );
}

export function PadIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <g transform="translate(24 24.5) scale(.172) translate(-128 -139)" strokeWidth="15">
        <path d="M76 70H180C212 70 230 92 236 128L244 170C248 194 234 208 216 208C200 208 192 200 182 184L174 172H82L74 184C64 200 56 208 40 208C22 208 8 194 12 170L20 128C26 92 44 70 76 70Z" fill="var(--sun)" />
        <path d="M55 108v32M39 124h32" />
        <circle cx="128" cy="124" r="25" fill="var(--card)" strokeWidth="10" />
        <path d="M128 112L138 119L134 131H122L118 119Z" fill="currentColor" stroke="none" />
        <circle cx="199" cy="108" r="6" fill="currentColor" stroke="none" />
        <circle cx="199" cy="142" r="6" fill="currentColor" stroke="none" />
        <circle cx="182" cy="125" r="6" fill="currentColor" stroke="none" />
        <circle cx="216" cy="125" r="6" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

export function ContractIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M11 5h20l8 8v28a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="var(--card)" />
      <path d="M31 5v8h8M15 20h16M15 26h10" />
      <path d="M15 35q3-6 5-1t4-1 3 1" />
      <path d="M33 38l9-15 4 2.5-9 15-5 1.5z" fill="var(--sun)" />
    </svg>
  );
}
