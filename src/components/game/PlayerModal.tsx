"use client";
import { Fragment } from "react";
import { Crest } from "@/components/art/Crest";
import { clubKit } from "@/components/art/clubKit";
import { Flag } from "@/components/art/Flag";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { TraitStrip } from "@/components/game/PlayIdentity";
import { SkillStarsGroup } from "@/components/game/widgets";
import { AttrValue, Badge, Modal } from "@/components/ui";
import { clubName } from "@/engine/data/world";
import { POSITION_LABEL } from "@/engine/players/attributes";
import { ATTR_LABEL, groupsFor } from "@/engine/players/model";
import { formatMoney } from "@/engine/players/economy";
import { avgRating } from "@/engine/players/generate";
import type { GameState, Player } from "@/engine/types";
import { age, name, ovr } from "@/game/selectors";

export function PlayerModal({ g, p, onClose }: { g: GameState; p: Player | null; onClose: () => void }) {
  if (!p) return null;
  const kit = clubKit(p.clubId, g.season);
  const groups = groupsFor(p.position);
  return (
    <Modal open={!!p} onClose={onClose} title={name(p)} wide>
      <div className="flex flex-wrap items-center gap-4">
        <PlayerPortrait appearance={p.look} age={age(g, p)} size={88} kit={kit} collar={kit.collar} />
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
          <div className="mt-2"><TraitStrip p={p} /></div>
        </div>
      </div>
      <div className="mt-4 gap-x-6 sm:columns-2">
        {groups.map((gr) => (
          <Fragment key={gr.label}>
          <div className="mb-4 break-inside-avoid">
            <h3 className="mb-1 text-xs font-black uppercase text-muted">{gr.label}</h3>
            {gr.keys.map((k) => (
              <div key={k} className="flex justify-between py-0.5 text-sm">
                <span>{ATTR_LABEL[k]}</span>
                <AttrValue v={p.attrs[k]} />
              </div>
            ))}
          </div>
          {gr.label === "Technical" && <SkillStarsGroup p={p} />}
          </Fragment>
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
