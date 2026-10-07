# Player portraits

> **Art direction has moved to hand-illustrated raster assets composed by code: see [PORTRAIT_ART.md](PORTRAIT_ART.md).**
> The procedural vector renderer described below is the interim stopgap until that art is delivered; do not extend
> it. The appearance data, generation, ageing and editor described here stay.

Portraits are built from data, not images: `<PlayerPortrait appearance age size kit />` draws SVG from a stored
`Appearance` (about 24 small integers per player), so it is sharp at any size, offline, instant and free.

## Art direction: illustrated football portrait

The target is a hand-drawn football editorial or trading-card portrait (flat cel-shaded planes, warm near-black ink
with varied weight), not an avatar maker. The art was established on one reference face first
(`REFERENCE_FACE` in `portrait/anatomy.ts`), then tested on six designed men with identical hair and a bald test, and only
then made modular.

- **Anatomy first.** The head is built from landmarks: crown, skull, temple, cheekbone, a jaw corner with a real (rounded)
  angle, chin corners and chin base (`buildHead`). Features sit on fixed lines (brow, eye, nose, mouth). Every part reads
  these landmarks and `head.half(y, side)`, so nothing is positioned by eye.
- **Flat planes, three tones.** Base, shadow and highlight, lit from the upper left: the right side plane with a
  cheekbone step, hollows under the cheekbones, eye sockets, the nose's side plane and cast shadow, the underside of
  the chin, the jaw's shadow on the neck, and the hair's shadow on the forehead. No gradients.
- **Features are constructions.** Eyes have a heavy tapered upper lid, crease, lower lid, iris under the lid, pupil and
  a small highlight. Noses have bridge lines, a side plane, alar wings, nostrils and a lit tip. Mouths have upper and
  lower lips, a tapered mouth line and a shadow under the lower lip. Brows are tapered shapes with a blunt, hairy head.
- **Designed asymmetry.** One eye is a touch less open and lower, one brow sits higher, the mouth corners and ears differ,
  one jaw corner is wider. Fixed per player (`asym`), never random per render.
- **Hair** has a hairline (separate from the cut), a mass with an irregular silhouette and leaning clump tips, fringe
  clumps over the forehead, directional highlight clumps and partings inside the mass, and fades drawn on the skin.
- **Line weights.** Silhouettes `OUT`, structure `MID`, details `FINE`; lid, mouth and brow lines are tapered ribbons.
- **Retro treatment last.** Grain and a small halftone screen in the deepest shadow are added from 96px up; the art must
  hold up without them.

## Modules (`src/components/art/portrait/`)

- `anatomy.ts`: `FaceSpec`, `REFERENCE_FACE`, `buildHead`.
- `specs.ts`: each stored option as anatomy (12 heads, 8 eye constructions, 10 brows, 12 noses, 10 mouths, 3 ears),
  `faceSpecFor(appearance, age)` and `modelFor`. Small per-player variation and asymmetry are seeded from the hidden
  `aging` gene and the feature's own index, so editing one feature never moves another.
- `face.tsx` (planes, eyes, brows, nose, mouth, ears, neck, shirt), `hair.tsx`, `facialHair.tsx`, `details.tsx`, and
  `art.tsx`, which layers them.
- `options.ts` (engine) keeps the option names and hairstyle data. No options were added for the art pass.

## Rules

- **Deterministic.** `generateAppearance(playerId)` uses its own seeded RNG, never the world stream.
- **Identity is permanent.** Changing club changes only the shirt and backdrop. Age changes grey, lines (the nose-to-mouth
  fold deepens, forehead lines from the mid thirties), hairline retreat and a softer jaw in the teens, never the face.
- **Saves.** Option indexes are append-only; old five-value avatars still upgrade through migration v5 -> v6.
- **Performance.** Below 96px a lite level draws fewer hair clumps and beard strands. Head and hair paths are defined
  once and reused with `<use>`, and path data is trimmed to one decimal. Ids are prefixed per instance (`useId`).

## QA sheets

- `npx tsx --tsconfig tsconfig.json scripts/portraits/reference.tsx out/` writes the art-direction sheets from explicit
  face specs: `reference` (plain and retro), `six` (six men, same hair), `bald`, `small`, `zoom`, plus every hairstyle
  and every facial-hair style.
- `npx tsx --tsconfig tsconfig.json scripts/portraits/sheet.tsx out/` writes sheets from the generator: `contact`
  (36 random players), `bald` (12), `silhouette`, `sizes` (48/64/96/256) and `zoom` (`ZOOM=3,9,14`).
- `node scripts/portraits/shoot.mjs out/` screenshots every sheet; `scripts/portraits/perf.tsx` prints cost per size.
