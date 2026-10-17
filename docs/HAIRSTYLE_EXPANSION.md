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
| 2 | Golden Buzz | **approved, committed** | see below |
| 3 | Rocket Spikes | **approved, committed** | see below |
| 4 | Samba Mohawk | **approved, committed** | see below |
| 5 | Crescent Patch | **excluded: duplicate** | Brazilian Crescent already is a small isolated frontal half-moon patch on an almost shaved scalp (`crescentHair`), the exact brief. A second style would be a recolour; the existing one is preserved unchanged. |
| 6 | Patterned High Top | **approved, committed** | see below |
| 7 | Slickback Flow | **implemented, awaiting approval** | see below |
| 8-11 | Nordic Sweep, Crown Taper, Pitch Cornrows, Warrior Knot | not started | Crown Taper must be compared with Curly Fade |

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

## Rocket Spikes

**Structural analysis.** Silhouette: short sides, moderately raised crown, five equal, evenly spaced broad spikes across the whole top.
Length: short. Crown: 8 units of mass plus spikes of one height (22). Parting: none. Fringe: short, angular, four small forward spikes over the
hairline, no long locks. Temples: close cap thinning to the top of the ear. Rear: not drawn. Hairline: straight, hung with the small
spikes. Flow: upward along the skull normal, so the row fans with the dome. Masses: one crown mass, five spikes. Variation (per review feedback:
spikes must be uniform): only a few percent of height and width per spike, seeded.

**Closest existing:** Frosted Faux Hawk (one central crest with the crest following the skull, flanked by faded sides) and Short
Textured (forward fringe of locks). Rocket Spikes has no central crest: spikes share the full width and height is moderate; it has no hanging
locks. New helper `spikesHair` (`hair/spikes.tsx`) is built from existing primitives (`shell`, `bumped`, `hanging`, `hairline`,
`fadeRegion`); a broad-spike profile (less concave than `tuft`) keeps spikes reading as masses, not thorns.

**Tests:** `tests/portraitSpikes.test.ts` (colours, determinism, seed variation, close sides on 24 head shapes, element counts, missing
fields) and the existing compat / next / beard / appearance suites: 70 passing. tsc and eslint clean.

**Review sheet:** `docs/hairstyles/rocket-spikes-review.png`.

**Limitations.** Spike tilt cannot show "forward" in a front view, so the front reads through the short angular fringe and a
band of shade under the hairline. Very dark hair on the darkest skin is carried by the outline and highlights.

## Samba Mohawk

**Structural analysis.** Silhouette: one tall, narrow crest (38 units above the skull, base half-width about half the temple
half-width, narrowing 50% into a crisp point) over cropped sides. Length: crest medium, sides short. Parting: none. Fringe: three
short tips hung over the forehead from the crest's lower edge. Temples/sides: a faint cap in tone fading to nothing at the ear.
Rear: continues behind the crest, not visible from the front. Hairline: the crest's own lower edge. Flow: straight up, centred, symmetric peak (per review feedback: no lean or shift); only the height varies slightly by seed. Masses: one connected crest; six small edge clumps, none near the peak.
Recognisable feature: tall sculptural central strip with clearly shorter sides.

**Closest existing:** Frosted Faux Hawk (a wider crest of spikes that merges with its fade); Rocket Spikes (spikes across the whole top).
The Samba Mohawk crest is much narrower and taller, has smooth clumped edges instead of spikes, and the rest of the head is visibly
cropped. New helper `mohawkHair` (`hair/mohawk.tsx`), built from existing primitives (`bumped`, `hanging`, `shell`, `fadeRegion`).

**Tests:** `tests/portraitMohawk.test.ts` plus the existing suites. **Review sheet:** `docs/hairstyles/samba-mohawk-review.png`.

**Limitations.** "Forward motion" and the rear continuation cannot show in a front view, so the front reads through the hung tips and
the shade band under the crest's lower edge. The cropped sides read as a soft skull cap in tone rather than individual hair.

## Patterned High Top

**Structural analysis.** Silhouette: a flat-topped rounded box, 26 units above the skull, standing 0.8 units past the head at the fade (flush with the head edge)
line. Length: block medium-tall, sides short. Parting: none. Fringe: none; the lower edge is the hairline, slightly uneven. Temples
and sides: a close fade of tone thinning to the top of the ear; clean boundary line to the block. Rear: not visible. Hair type: coily/
textured (compact clumps). Flow: vertical. Masses: one block with a slightly tilted flat top and five compact edge clumps. Pattern:
one of none / line / step / double shaved lines on the fade, chosen by the seed, full size only. Recognisable: boxy, flat, tall.

**Closest existing:** Lion Afro and Medium Afro (round clouds of lobed curls). The high top is a flat box with straight walls and a
flat top, short faded sides and no curl lobes, so the silhouettes share nothing. New helper `highTopHair` (`hair/hightop.tsx`), built
from existing primitives (`bumped`, `shell`, `fadeRegion`, `organicMass`, `strokeLine`). No global pattern architecture was added:
the patterns are four small constants inside the style.

**Bug fixed on the way:** a clip id collided with the skin halftone pattern id (`<uid>ht`); the style now uses `<uid>hk`.

**Review sheet:** `docs/hairstyles/patterned-high-top-review.png`. **Tests:** `tests/portraitHighTop.test.ts` plus existing suites.

**Limitations.** Shaved lines are thin by design and vanish below 140px. The block shows no individual curls at any size, only
compact value clumps.

## Slickback Flow

**Structural analysis.** Silhouette: low crown, a high front lift off centre that eases down on the other side, thin sides that end flush
with the head edge. Length: medium top, short sides. Parting: none. Fringe: none. Temples: tapered into a short fade. Rear: swept back,
hidden in a front view. Flow: five broad sections, each rooted on the hairline and running in one long smooth curve to the outline;
all bow the same way (combed, not fanned), outer ones a little more. Masses: tiled sections told apart by value, a soft
left-to-right tone gradient and restrained contact shadows; one thin curved highlight on the left sections at full size.
Asymmetry: lift position and side, section spacing, widths, end points.

**Review iterations (this style was reworked three times):** v1 a dome with a few strokes (read as a helmet); v2 overlapping
floating sections (tangled curls at the front); v3 (current) sections that tile the whole mass, parallel-ish flow, curved
highlights, tapering sides. Comparison: `docs/hairstyles/slickback-flow-before-after.png` (default, black silhouette, 48/96px).

**Closest existing:** Long Flow, Classic Curtains. Neither has a lifted front or hair swept back off the face, and neither is short
at the sides. New helper `slickHair` (`hair/slick.tsx`) from existing primitives (`shell`, `bumped`, `taperedLock`, `hairStroke`, `fadeRegion`).

**Review sheet:** `docs/hairstyles/slickback-flow-review.png`. **Tests:** `tests/portraitSlick.test.ts` plus existing suites.

**Limitations.** Rear length and the back-sweep in depth are not visible from the front; the flow reads through section direction and
silhouette. At 48px only three sections and the silhouette remain.
