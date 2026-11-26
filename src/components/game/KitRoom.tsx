"use client";
import { Badge } from "@/components/ui";
import { COSMETICS, cosmeticDef, type CosmeticDef } from "@/engine/career/goals";
import type { CosmeticKind } from "@/engine/types";

/** A side-on football boot in two colours. */
export function Boot({ colors, size = 56, label }: { colors: [string, string]; size?: number; label?: string }) {
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 100 55" role="img" aria-label={label ?? "Boots"}>
      <path d="M8 18 C8 10 16 6 26 8 L44 12 C52 14 58 20 66 24 L88 30 C96 32 98 40 92 44 L12 44 C6 44 6 38 8 32 Z" fill={colors[0]} stroke="var(--line)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M10 44 L92 44 L90 49 L12 49 Z" fill={colors[1]} stroke="var(--line)" strokeWidth="3" strokeLinejoin="round" />
      {[22, 40, 60, 78].map((x) => <rect key={x} x={x} y={49} width={5} height={5} rx={1} fill="var(--line)" />)}
      <path d="M30 14 L40 30 M38 15 L48 30 M46 18 L54 30" stroke={colors[1]} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const KIND_LABEL: Record<CosmeticKind, string> = { boots: "Boots", kit: "Kit colours", celebration: "Celebrations" };

function Item({ c, owned, active, fresh, onEquip, clubKit }: { c: CosmeticDef; owned: boolean; active: boolean; fresh: boolean; onEquip: (id: string) => void; clubKit?: string }) {
  return (
    <button
      type="button"
      disabled={!owned}
      onClick={() => onEquip(c.id)}
      aria-pressed={active}
      aria-label={`${c.name}${owned ? "" : " (locked)"}`}
      className={`relative flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-line p-2 text-center text-xs font-bold ${active ? "bg-sun-2 shadow-[2px_2px_0_var(--shadow)]" : owned ? "bg-card hover:bg-paper-2" : "bg-paper-2 opacity-60"}`}
    >
      {c.kind === "boots" && c.colors && <Boot colors={c.colors} label={c.name} />}
      {c.kind === "kit" && (
        <span className="flex h-8 w-12 overflow-hidden rounded-md border-2 border-line" aria-hidden>
          <span className="flex-1" style={{ background: c.colors?.[0] ?? clubKit ?? "#888" }} />
          <span className="w-2" style={{ background: c.colors?.[1] ?? "#fff" }} />
        </span>
      )}
      {c.kind === "celebration" && <span className="text-2xl" aria-hidden>{c.icon}</span>}
      <span>{c.name}</span>
      {!owned && <span aria-hidden className="absolute right-1 top-1">🔒</span>}
      {fresh && owned && <span className="absolute left-1 top-1"><Badge tone="coral">New</Badge></span>}
    </button>
  );
}

/** Boots, kit colours and celebrations: owned ones can be equipped; locked ones come from weekly goals. */
export function KitRoom({ owned, equipped, onEquip, newly = [], clubKit, kinds = ["boots", "kit", "celebration"] }: { owned: readonly string[]; equipped: Partial<Record<CosmeticKind, string>>; onEquip: (id: string) => void; newly?: readonly string[]; clubKit?: string; kinds?: CosmeticKind[] }) {
  const has = new Set(owned);
  const cel = cosmeticDef(equipped.celebration);
  return (
    <div className="grid gap-4" data-testid="kit-room">
      {kinds.map((kind) => (
        <section key={kind}>
          <h3 className="mb-2 text-sm font-bold">
            {KIND_LABEL[kind]} <span className="font-normal text-muted">· {COSMETICS.filter((c) => c.kind === kind && has.has(c.id)).length}/{COSMETICS.filter((c) => c.kind === kind).length}</span>
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {COSMETICS.filter((c) => c.kind === kind).map((c) => (
              <Item key={c.id} c={c} owned={has.has(c.id)} active={equipped[kind] === c.id} fresh={newly.includes(c.id)} onEquip={onEquip} clubKit={clubKit} />
            ))}
          </div>
          {kind === "celebration" && cel && <p className="mt-2 text-xs text-ink-2">After you score, you {cel.line}.</p>}
        </section>
      ))}
      <p className="text-[11px] text-muted">Cosmetics never change the football. Unlock more by completing weekly goals; unlocks carry over to new careers in this browser.</p>
    </div>
  );
}
