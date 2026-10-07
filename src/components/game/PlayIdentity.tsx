"use client";
import { useState } from "react";
import { Badge, Card } from "@/components/ui";
import { STAGE_LABEL } from "@/engine/traits/effects";
import { groupTraits, identityOf, type TraitRow } from "@/engine/traits/identity";
import type { GameState, Player, TraitStage } from "@/engine/types";

const STAGE_TONE: Record<TraitStage, "sun" | "pitch" | "paper"> = { signature: "sun", established: "pitch", emerging: "paper" };

/** One trait as a chip; the native tooltip (and the optional description row) says what it does. */
export function TraitChip({ row, flaw = false }: { row: TraitRow; flaw?: boolean }) {
  return (
    <span title={`${row.def.name} · ${STAGE_LABEL[row.stage]}\n${row.def.blurb}`}>
      <Badge tone={flaw ? "coral" : STAGE_TONE[row.stage]} className={row.stage === "emerging" ? "opacity-80" : ""}>
        {row.stage === "signature" && <span aria-hidden>★</span>}
        {row.def.name}
      </Badge>
    </span>
  );
}

function Group({ label, rows, flaw, explain }: { label: string; rows: TraitRow[]; flaw?: boolean; explain: boolean }) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-black uppercase tracking-wider text-muted">{label}</div>
      {explain ? (
        <ul className="grid gap-1.5">
          {rows.map((r) => (
            <li key={r.def.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <TraitChip row={r} flaw={flaw} />
              <span className="text-ink-2">{r.def.blurb}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-1.5">{rows.map((r) => <TraitChip key={r.def.id} row={r} flaw={flaw} />)}</div>
      )}
    </div>
  );
}

/** The Play Identity card: how this player tends to play, not how good they are. */
export function PlayIdentityCard({ g, p, title = "Play identity" }: { g: GameState; p: Player; title?: string }) {
  const [explain, setExplain] = useState(false);
  const groups = groupTraits(p);
  const signature = groups.style.filter((r) => r.stage === "signature");
  const rest = groups.style.filter((r) => r.stage !== "signature");
  const established = rest.filter((r) => r.stage === "established");
  const emerging = rest.filter((r) => r.stage === "emerging");
  const empty = !groups.style.length && !groups.mindBody.length && !groups.personality.length && !groups.flaws.length;
  const identity = identityOf(g, p);
  return (
    <Card title={title}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-bold capitalize">{identity.label}</div>
        {!empty && (
          <button type="button" onClick={() => setExplain((v) => !v)} className="text-xs font-bold text-muted underline-offset-2 hover:underline">
            {explain ? "Hide details" : "What do these mean?"}
          </button>
        )}
      </div>
      {empty ? (
        <p className="text-sm text-muted">No defining habits yet. How you play, train and behave will shape one.</p>
      ) : (
        <div className="grid gap-3">
          <Group label="Signature" rows={signature} explain={explain} />
          <Group label="Established" rows={[...established, ...groups.mindBody.filter((r) => r.stage !== "emerging")]} explain={explain} />
          <Group label="Taking shape" rows={[...emerging, ...groups.mindBody.filter((r) => r.stage === "emerging")]} explain={explain} />
          <Group label="Personality" rows={groups.personality} explain={explain} />
          <Group label="Flaws" rows={groups.flaws} flaw explain={explain} />
        </div>
      )}
    </Card>
  );
}

/** Compact one-line version for hero banners and modals. */
export function TraitStrip({ p, max = 4 }: { p: Pick<Player, "traits">; max?: number }) {
  const g = groupTraits(p);
  const rows = [...g.style, ...g.mindBody].slice(0, max);
  if (!rows.length) return null;
  return <div className="flex flex-wrap gap-1.5">{rows.map((r) => <TraitChip key={r.def.id} row={r} />)}</div>;
}
