import { country } from "@/engine/data/world";

/** Country flag via flag-icons (MIT). Falls back to a code badge. */
export function Flag({ code, className = "" }: { code: string | undefined; className?: string }) {
  const c = code ? country(code) : undefined;
  if (!c) return <span className={`inline-block rounded bg-paper-2 px-1 text-[10px] font-bold ${className}`}>{code ?? "?"}</span>;
  return <span className={`fi fi-${c.flag} rounded-[3px] shadow-[0_0_0_1.5px_var(--line)] ${className}`} role="img" aria-label={c.name} title={c.name} />;
}
