"use client";
import { useState } from "react";
import { Badge, Card, Modal } from "@/components/ui";
import { STAGE_LABEL } from "@/engine/traits/effects";
import { TRAINING_FOCUS } from "@/engine/players/development";
import { NO_FOCUS } from "@/engine/players/focus";
import { focusReading, groupTraits, identityOf, positionTag, type FocusInfluence, type FocusVerdict, type TraitRow } from "@/engine/traits/identity";
import type { GameState, Player, TraitStage } from "@/engine/types";

/** What each tier means for the player, shown under its heading so "Taking shape" and "Established" are never a guess. */
const STAGE_HINT: Record<TraitStage, string> = {
  signature: "Defines your game, at full strength.",
  established: "A dependable part of your game, fully active.",
  emerging: "A new habit, active at half strength. Keep doing it to build it; neglect it and it fades.",
};

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

function Group({ label, hint, rows, flaw, explain = false }: { label: string; hint?: string; rows: TraitRow[]; flaw?: boolean; explain?: boolean }) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-black uppercase tracking-wider text-muted">{label}</div>
      {hint && <p className="mb-1.5 text-xs text-muted">{hint}</p>}
      {explain ? (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.def.id} className="grid gap-0.5 text-sm">
              <div className="flex flex-wrap items-center gap-x-2">
                <TraitChip row={r} flaw={flaw} />
                {positionTag(r.def) && <span className="text-xs font-bold text-muted">{positionTag(r.def)}</span>}
              </div>
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

const INFLUENCE: Record<FocusInfluence, string> = {
  shaping: "Still shaping your early development.",
  fading: "Fading: your match record counts for more every season.",
  settled: "Behind you now: what you have shown on the pitch decides who you are.",
};

const VERDICT: Record<FocusVerdict, string> = {
  open: "You left it open. Your career is deciding who you are.",
  early: "Nothing has taken shape yet. How you play will decide.",
  aligned: "Your game is developing along the lines you set out.",
  mixed: "Part of your game matches what you set out to be; part of it is new.",
  diverged: "Your career has taken you somewhere new.",
};

/** What you set out to become next to what the career has shown. Shown on Training, where it can guide the work. */
function FocusBlock({ p, season }: { p: Player; season: number }) {
  const r = focusReading(p, season);
  const open = r.focus.id === NO_FOCUS;
  return (
    <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl border-2 border-line bg-paper-2/60 p-3 sm:gap-x-6" data-testid="development-focus">
      <div className="min-w-0 break-words">
        <div className="text-xs font-black uppercase tracking-wider text-muted">Desired playstyle</div>
        <div className="font-display text-lg uppercase leading-tight">{r.focus.name}</div>
        <p className="text-sm text-ink-2">{r.focus.blurb}</p>
        {!open && <p className="mt-1 text-xs font-bold text-muted">{r.focus.areas.join(" · ")}</p>}
        {!open && <p className="mt-1 text-xs text-muted">{INFLUENCE[r.influence]}</p>}
        {!open && r.focus.training.length > 0 && r.influence !== "settled" && (
          <p className="mt-2 text-xs text-ink-2">
            Suggested training: <b>{r.focus.training.map((t) => TRAINING_FOCUS[t].label).join(" · ")}</b>. It builds what this role leans on; it does not give you a trait.
          </p>
        )}
        <p className="mt-1 text-xs text-muted">What you are trying to become.</p>
      </div>
      <div className="min-w-0 break-words">
        <div className="text-xs font-black uppercase tracking-wider text-muted">What your career shows</div>
        <div className="mt-0.5 text-sm font-bold">{r.current.length ? r.current.slice(0, 3).map((t) => t.def.name).join(" · ") : "Nothing defined yet"}</div>
        <p className="mt-1 text-sm text-ink-2">{VERDICT[r.verdict]}</p>
        <p className="mt-1 text-xs text-muted">What you actually are. Only play, training and behaviour change this.</p>
      </div>
    </div>
  );
}

/** The Play Identity card: how this player tends to play, not how good they are. */
export function PlayIdentityCard({ g, p, title = "Play identity", showFocus = false }: { g: GameState; p: Player; title?: string; showFocus?: boolean }) {
  const [open, setOpen] = useState(false);
  const groups = groupTraits(p);
  const signature = groups.style.filter((r) => r.stage === "signature");
  const rest = groups.style.filter((r) => r.stage !== "signature");
  const established = rest.filter((r) => r.stage === "established");
  const emerging = rest.filter((r) => r.stage === "emerging");
  const empty = !groups.style.length && !groups.mindBody.length && !groups.personality.length && !groups.flaws.length;
  const identity = identityOf(g, p);
  const sections = (explain: boolean) => (
    <>
      <Group label={STAGE_LABEL.signature} hint={STAGE_HINT.signature} rows={signature} explain={explain} />
      <Group label={STAGE_LABEL.established} hint={STAGE_HINT.established} rows={[...established, ...groups.mindBody.filter((r) => r.stage !== "emerging")]} explain={explain} />
      <Group label={STAGE_LABEL.emerging} hint={STAGE_HINT.emerging} rows={[...emerging, ...groups.mindBody.filter((r) => r.stage === "emerging")]} explain={explain} />
      <Group label="Personality" rows={groups.personality} explain={explain} />
      <Group label="Flaws" rows={groups.flaws} flaw explain={explain} />
    </>
  );
  return (
    <Card title={title}>
      {showFocus && <FocusBlock p={p} season={g.season} />}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-bold capitalize">{identity.label}</div>
        {!empty && (
          <button type="button" onClick={() => setOpen(true)} className="pb-hit text-xs font-bold text-muted underline-offset-2 hover:underline">
            What do these mean?
          </button>
        )}
      </div>
      {empty ? (
        <p className="text-sm text-muted">No defining habits yet. How you play, train and behave will shape one.</p>
      ) : (
        <div className="grid gap-3">{sections(false)}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="What your traits mean">
        <p className="mb-3 text-sm text-ink-2">Traits describe how you play, not how good you are. ★ marks a signature trait; red ones are flaws.</p>
        <div className="grid gap-4">{sections(true)}</div>
      </Modal>
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
