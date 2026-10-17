# Iconic football hairstyle expansion

Eleven generic styles inspired by recognisable football haircut silhouettes (never faces, never player names). Built one at
a time, each stopping for approval. All live in `src/components/art/portrait-next/hair/` on the existing architecture.

## Existing architecture (what every style reuses)

- **Registry:** `HAIR_LIBRARY` in `hair/index.tsx` (id, generic name, category, rarity, ears, headband flags) plus an append-only
  option in `HAIR_STYLES` (`src/engine/appearance/options.ts`, `iconic: true`) and the option-index map `POC_IDS`.
- **Inputs:** `HairInput` = face spec, head outline, colour, skin tones, per-instance `uid`, detail level `d` (0 = under 72px,
  1 = under 140px, 2 = large), age recession, player `seed`. Output is layered `HairArt` (back / onSkin / mid / front / band).
- **Anchors and geometry:** `hairline()` (corners, temple lines, seeded per-side offsets), `shell()` (skull outline pushed out
  by hair thickness, so volume follows each head), `bumped`, `lobe`, `tuft`, `taperedLock`, `organicMass`, `fadeRegion`.
- **Tone:** `hairTones(colour, skin)` gives base / shade / deep / light; the outer silhouette is the only heavy ink.
- **Variation:** `rnd(seed, i, lo, hi)` and `hash01`, never `Math.random`.
- **Size:** `d` picks how many shapes are built; element counts must stay below the full-size count.
- **Tests:** `portraitCompat` (all face shapes x styles x sizes, metadata, generation), `portraitNext` (determinism, element counts).
- **Review tooling:** `scripts/portraits/hairsheet.tsx <out> "<Name>" "<Neighbour,Neighbour>"` writes the eight-row review sheet
  from the real renderer; `scripts/portraits/shoot.mjs` screenshots it.

## Duplicate and eligibility check

| # | Style | Status | Notes |
|---|---|---|---|
| 1 | Playmaker Waves | already implemented (before this task) | not recreated |
| 2 | Golden Buzz | **implemented, awaiting approval** | see below |
| 3-11 | Rocket Spikes, Samba Mohawk, Crescent Patch, Patterned High Top, Slickback Flow, Nordic Sweep, Crown Taper, Pitch Cornrows, Warrior Knot | not started | Crescent Patch must be compared with Brazilian Crescent first; Crown Taper with Curly Fade |

## Golden Buzz

**Structural analysis.** Silhouette: scalp-following, a few units off the skull. Length: ultra short. Crown volume: none beyond
2.6-3.6 units. Parting: none. Fringe: none. Temples: clean, sideburn stops at the top of the ear. Sides: same length as top.
Rear: compact, not drawn. Hairline: natural, slightly uneven, raised 2.5 units, feathered rather than cut. Hair type: straight, very
short. Flow: none (value only). Masses: one thin mass. Locks/sections: none. Asymmetry: seeded crown fullness, hairline
unevenness, per-side temple offsets. Recognisable feature: ultra-low silhouette with a visible hairline.

**Closest existing:** Shaved (`shavedHair`, tone only on the skin, no silhouette) and Short Textured (fringe, locks, tufts).
Golden Buzz is a real mass with its own outline and hairline, so it reads as hair rather than a bare scalp, and has none of
the crop's volume. No existing primitive expressed a thin skull-following mass cleanly, so `buzzHair` (`hair/buzz.tsx`) is the
one new helper, built only from existing primitives (`shell`, `hairline`, `fadeRegion`, `silhouetteInk`).

**Approach.** Skull shell pushed out by seeded thickness, closed by the hairline and temple lines; skin underneath covered so the
head outline doesn't show through; density fades from crown to hairline and sideburn; dome light follows the skull on the upper
left, far side turns into shade; at d >= 1 two to four wide, faint density patches (never strokes). 48px keeps the mass, dome
shading, hairline and outline. Colour comes from the player's hair colour only.

**Tests (all passing):** `tests/portraitBuzz.test.ts` (registry, all 11 colours, determinism and seed variation, thickness limit
on 48 head shapes, element counts vs Short Textured and across sizes, missing fields and age), plus the existing compat,
neck/hair, beard and appearance suites (63 tests). `tsc` and eslint clean. Existing styles' files are untouched.

**Review sheet:** `docs/hairstyles/golden-buzz-review.png` (regenerate with the script above).

**Limitations.** Dark hair on the darkest skin has low contrast inside the mass (the outline carries it, as with other short
styles). Pure-black silhouette is a rounded cap because the whole scalp above the hairline is hair. Not yet added to a master
comparison sheet (done once more styles exist).
