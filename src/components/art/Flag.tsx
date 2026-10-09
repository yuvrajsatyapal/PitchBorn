import { country } from "@/engine/data/world";

/** Nations outside the playable world that can still appear as a manager's nationality. */
const EXTRA_FLAGS: Record<string, { flag: string; name: string }> = {
  ISL: { flag: "is", name: "Iceland" },
  BIH: { flag: "ba", name: "Bosnia and Herzegovina" },
  CHI: { flag: "cl", name: "Chile" },
  ROU: { flag: "ro", name: "Romania" },
  LUX: { flag: "lu", name: "Luxembourg" },
};

/** Country flag via flag-icons (MIT). Falls back to a code badge. */
export function Flag({ code, className = "" }: { code: string | undefined; className?: string }) {
  const c = code ? country(code) ?? EXTRA_FLAGS[code] : undefined;
  if (!c) return <span className={`inline-block shrink-0 rounded bg-paper-2 px-1 text-[10px] font-bold ${className}`}>{code ?? "?"}</span>;
  return <span className={`fi fi-${c.flag} shrink-0 align-middle rounded-[3px] shadow-[0_0_0_1.5px_var(--line)] ${className}`} role="img" aria-label={c.name} title={c.name} />;
}
