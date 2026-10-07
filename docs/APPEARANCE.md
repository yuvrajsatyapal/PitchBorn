# Player portraits

Portraits are built from data, not images: `<PlayerPortrait appearance age size kit />` draws SVG layers from a stored
`Appearance` (about 24 small integers per player), so it is sharp at any size, offline and free.

- **Layers** (back to front): background, shirt, back hair, neck, collar, ears, face + two-tone shading, age lines and
  details, nose, eyes, eyebrows, mouth, facial hair, front hair, accessory, then one grain overlay on large portraits.
- **One coordinate system.** Every part is placed from `portrait/geometry.ts`. The face outline is a contour function
  (`contour.half(y)`), and beards, ears and hair read from it, so a part cannot drift off a different face shape.
- **Fine tuning.** Six small numeric sliders (head width/height, eye spacing, brow angle, nose size, ear size) sit under
  the discrete options so the same face/nose/eyes combination is not identical on two players. Ranges are deliberately small.
- **Deterministic.** `generateAppearance(playerId)` uses its own seeded RNG, never the world stream, so a player always
  looks the same. Regional skin lean is optional, mild and never deterministic.
- **Ageing.** `ageLook(appearance, age)` returns grey, lines, hairline retreat and youth. It changes only colour, lines and
  hairline; face shape, eyes, nose, mouth and geometry never change. The stored `aging` gene shifts when greying/receding start.
- **Data lives in** `engine/appearance/options.ts` (39 hairstyles, 12 faces, 8 eye shapes, 12 noses, 10 mouths, 10 brows, 16 facial
  hair styles, 10 skin tones, 10 hair colours, 6 eye colours, scars, marks, accessories).
- **Saves.** Old five-value avatars are upgraded by schema migration v5 -> v6, keeping the player's choices.
- **Performance.** The ink wobble filter only runs from 56px up and the grain from 96px up; the component is memoised on
  the face data.

## Art direction: retro editorial football portrait

The target is a 1970s-90s football magazine or trading-card illustration, not an avatar maker.

- **Identity lives in the face.** Twelve face outlines are separate silhouettes (own temple, cheekbone, jaw angle, chin
  width, curve tension, optional chin cleft). Eyes, brows, noses and mouths each carry their own construction, and the
  second eye/brow is slightly smaller, lower and flatter. Hair is secondary: run the bald test below.
- **Expression.** Mouths are weighted towards neutral/stern/thin; grins are rare, brow slant leans serious.
- **Modelling.** Skin uses base/shadow/highlight with light from the upper left: brow-ridge, nose plane, cheekbone, jaw and
  under-jaw shadows, a halftone screen in the deepest shade, and warmer highlights on dark skin.
- **Hair** has silhouette + hairline + inner texture (clipped strand groups, curl clusters, form shadow, a shadow on the
  forehead). **Stubble and beards** use tiled flecks/ticks, not flat polygons.
- **Frame.** Head, neck and collar fill the card on a muted print-ink backdrop (navy, green, brown, burgundy, slate,
  cream) chosen per face and kept clear of the shirt colour; halftone dots, grain and slightly irregular ink are shared.
- **Unique ids.** Clip paths and patterns are prefixed with a per-instance id so many portraits can sit on one page.

### QA sheets

`npx tsx scripts/portraits/sheet.tsx out/ && node scripts/portraits/shoot.mjs out/` writes `contact` (36 random
players), `bald` (12 bald + clean-shaven), `silhouette`, `sizes` (48/64/96/256) and `zoom` (`ZOOM=3,9,14`) sheets.
