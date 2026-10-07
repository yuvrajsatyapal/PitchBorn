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
- **Data lives in** `engine/appearance/options.ts` (39 hairstyles, 8 faces, 8 eye shapes, 10 noses, 10 mouths, 16 facial
  hair styles, 10 skin tones, 10 hair colours, 6 eye colours, scars, marks, accessories).
- **Saves.** Old five-value avatars are upgraded by schema migration v5 -> v6, keeping the player's choices.
- **Performance.** The ink wobble filter only runs from 56px up and the grain from 96px up; the component is memoised on
  the face data.
