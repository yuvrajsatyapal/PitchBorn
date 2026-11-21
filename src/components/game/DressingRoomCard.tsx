import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { clubKit } from "@/components/art/clubKit";
import { Badge, Card } from "@/components/ui";
import { bondBoost, bondsByStrength, type BondLabel } from "@/engine/career/chemistry";
import type { GameState } from "@/engine/types";

const TONE: Record<BondLabel, "plum" | "pitch" | "sky" | "paper" | "sun" | "coral"> = {
  Telepathic: "plum",
  Partnership: "pitch",
  Friends: "sky",
  Teammates: "paper",
  Rivals: "sun",
  Feud: "coral",
};

/** The user's bonds at the club: partners who sharpen his game, friends, and the ones he can't stand. */
export function DressingRoomCard({ g }: { g: GameState }) {
  const all = bondsByStrength(g).filter((b) => b.player.clubId === g.players[g.user.playerId]?.clubId);
  const close = all.filter((b) => b.bond.v >= 30).slice(0, 5);
  const cold = all.filter((b) => b.bond.v <= -30).slice(-3).reverse();
  const kit = clubKit(g.players[g.user.playerId]?.clubId, g.season);
  const row = (b: (typeof all)[number]) => {
    const boost = bondBoost(b.bond.v);
    const pct = Math.abs(b.bond.v);
    return (
      <li key={b.player.id} className="flex items-center gap-3">
        <PlayerPortrait appearance={b.player.look} age={g.season - b.player.birthYear} size={36} kit={kit} collar={kit.collar} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-bold">{b.player.firstName[0]}. {b.player.lastName}</span>
            <span className="text-xs text-muted">{b.player.position}</span>
            <Badge tone={TONE[b.label]}>{b.label}</Badge>
            {boost !== 0 && <span className={`text-xs font-bold ${boost > 0 ? "text-pitch" : "text-coral"}`}>{boost > 0 ? `+${boost} link-up together` : `${boost} composure together`}</span>}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full border border-line/40 bg-paper-2" role="meter" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(b.bond.v)} aria-label={`Bond with ${b.player.lastName}`}>
            <div className={`h-full ${b.bond.v >= 0 ? "bg-pitch" : "bg-coral"}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {b.bond.games} games together{b.bond.links ? ` · ${b.bond.links} goal${b.bond.links === 1 ? "" : "s"} combined` : ""}
          </div>
        </div>
      </li>
    );
  };
  return (
    <Card title="🤝 Dressing room">
      {close.length === 0 && cold.length === 0 ? (
        <p className="text-sm text-ink-2">No strong bonds yet. Play alongside teammates, set each other up and they&apos;ll start to click. Partnerships make you both sharper when you start together.</p>
      ) : (
        <div className="grid gap-4">
          {close.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-muted">Closest</div>
              <ul className="grid gap-3">{close.map(row)}</ul>
            </div>
          )}
          {cold.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-muted">Friction</div>
              <ul className="grid gap-3">{cold.map(row)}</ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
