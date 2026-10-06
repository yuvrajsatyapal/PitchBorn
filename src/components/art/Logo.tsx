export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Pitchborn">
      <circle cx="24" cy="24" r="21" fill="var(--sun)" stroke="var(--line)" strokeWidth="3" />
      <path d="M24 6 L29 15 L24 21 L19 15 Z M10 18 L19 15 L19 26 L12 30 Z M38 18 L29 15 L29 26 L36 30 Z M17 38 L19 26 L29 26 L31 38 L24 42 Z" fill="var(--ink)" />
      <circle cx="24" cy="24" r="21" fill="none" stroke="var(--line)" strokeWidth="3" />
    </svg>
  );
}
