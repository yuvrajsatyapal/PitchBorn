"use client";
import { Crest } from "@/components/art/Crest";
import { Flag } from "@/components/art/Flag";
import { Portrait } from "@/components/art/Portrait";
import { AttrValue, Badge, Modal } from "@/components/ui";
import { clubName, staticClub } from "@/engine/data/world";
import { ATTR_GROUPS, ATTR_LABEL, POSITION_LABEL } from "@/engine/players/attributes";
import { formatMoney } from "@/engine/players/economy";
import { avgRating } from "@/engine/players/generate";
import type { GameState, Player } from "@/engine/types";
import { age, name, ovr } from "@/game/selectors";

export function PlayerModal({ g, p, onClose }: { g: GameState; p: Player | null; onClose: () => void }) {
  if (!p) return null;
  const groups = ATTR_GROUPS.filter((gr) => (p.position === "GK" ? true : gr.label !== "Goalkeeping"));
  return (
    <Modal open={!!p} onClose={onClose} title={name(p)} wide>
      <div className="flex flex-wrap items-center gap-4">
        <Portrait look={p.look} size={84} kit={staticClub(p.clubId ?? "")?.colors.primary} />
        <div className="flex-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Flag code={p.nationality} /> {POSITION_LABEL[p.position]} · Age {age(g, p)} · {p.height}cm
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Crest clubId={p.clubId} size={18} /> {clubName(p.clubId)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="sun">OVR {ovr(p)}</Badge>
            <Badge>Value {formatMoney(p.value)}</Badge>
            {p.contract && <Badge>{formatMoney(p.contract.wage)}/wk</Badge>}
            <Badge>{p.career.apps} apps · {p.career.goals} G</Badge>
            {p.intl.caps > 0 && <Badge tone="sky">{p.intl.caps} caps</Badge>}
            {p.injury && <Badge tone="coral">Injured</Badge>}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {groups.map((gr) => (
          <div key={gr.label}>
            <div className="mb-1 text-xs font-black uppercase text-muted">{gr.label}</div>
            {gr.keys.map((k) => (
              <div key={k} className="flex justify-between py-0.5 text-sm">
                <span>{ATTR_LABEL[k]}</span>
                <AttrValue v={p.attrs[k]} />
              </div>
            ))}
          </div>
        ))}
      </div>
      {Object.keys(p.season).length > 0 && (
        <div className="mt-3 text-sm text-ink-2">
          This season:{" "}
          {Object.entries(p.season)
            .map(([k, s]) => `${g.competitions[k]?.shortName ?? k}: ${s.apps} apps, ${s.goals} G, ${s.assists} A, avg ${avgRating(s).toFixed(2)}`)
            .join(" · ")}
        </div>
      )}
    </Modal>
  );
}
