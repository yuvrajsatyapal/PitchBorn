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
      <path d="M14 14h20q8 0 10 10l1.5 8q.8 6-4 6-3.2 0-5-3l-2.5-4h-16l-2.5 4q-1.8 3-5 3-4.8 0-4-6L4 24q2-10 10-10z" fill="var(--sun)" />
      <path d="M15 21v8M11 25h8" />
      <circle cx="32" cy="22.5" r="1.8" fill="currentColor" />
      <circle cx="36.5" cy="26.5" r="1.8" fill="currentColor" />
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
