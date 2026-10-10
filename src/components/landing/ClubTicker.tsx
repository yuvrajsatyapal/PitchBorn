import { Crest } from "@/components/art/Crest";
import { WORLD } from "@/engine/data/world";

const TICKER_CLUBS = WORLD.clubs.filter((c) => c.prestige > 70).slice(0, 40);

/**
 * Every item carries its own right padding (no flex gap) so the two copies are exactly half the track each and the
 * -50% loop lands on a pixel-identical frame. Decorative, so hidden from assistive tech; reduced motion gets a static,
 * scrollable strip instead (see .pb-ticker in globals.css).
 */
export function ClubTicker() {
  const loop = [...TICKER_CLUBS, ...TICKER_CLUBS];
  return (
    <section id="clubs" aria-label="Clubs in the game" className="scroll-mt-24">
      <div className="pb-ticker overflow-hidden rounded-full border-2 border-line bg-ink py-3 text-paper" aria-hidden>
        <div className="anim-ticker flex w-max">
          {loop.map((c, i) => (
            <span key={`${c.id}-${i}`} className="flex shrink-0 items-center gap-2.5 pr-9 text-sm font-bold leading-none">
              <Crest clubId={c.id} size={26} /> {c.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
