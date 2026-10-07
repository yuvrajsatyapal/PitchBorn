# Portrait art: hand-illustrated, composed by code

Portraits must look like **an illustrator drew this footballer**: hand-drawn football magazine and vintage
trading-card portraits, organic ink, individually drawn hair clumps and locks, natural anatomy and a subtle print feel.
They must not look like an avatar generator, Bitmoji or procedural vector art.

**The rule: artists draw, code composes.** The code selects, layers, colours, fits, caches and randomises
hand-drawn raster layers. It never draws artwork.

Related: [hairstyle library](portrait-art/HAIRSTYLES.md) (100 styles), [first art test checklist](portrait-art/POC_ASSETS.md)
(144 layer files), [appearance data](APPEARANCE.md).

## 1. Where things stand

| Part | Status |
|---|---|
| Composition pipeline (`components/art/illustrated/`) | Built and tested in Chromium: colour masks, multiply shadows, screen highlights, ink, trimmed offsets, fit transforms. |
| Asset build (`npm run portraits:assets`) | Built: validates, trims, converts to WebP, writes the manifest, checks budgets. |
| Canvas guide for artists | `art/portrait/guides/canvas-guide.{svg,png,@2x.png}`, generated from the code's landmarks. |
| Hairstyle library, rarity, age/era weighting | 100 styles described; 12 proof-of-concept slots prepared; nothing generated or shown until its art is `ready`. |
| **Artwork** | **None delivered.** Every slot is empty. The QA sheets show labelled placeholder boxes, not art. |
| What players see today | The previous vector renderer (`components/art/portrait/`), kept only as a stopgap. It switches off per portrait as soon as every layer that portrait needs is delivered. Do not extend it. |

## 2. Audit of the previous renderer

Everything visible in the previous portraits was procedurally drawn SVG geometry, and all of it is replaced by
illustrated assets:

| Previously procedural | Becomes |
|---|---|
| Head outline from landmark Béziers, flat cel planes (side plane, cheek hollows, sockets, chin) | `faces/<shape>`: mask + painted shadow + highlight + ink |
| Eyes (lid ribbons, iris circles, creases) | `eyes/<shape>`: white, iris mask, shadow, ink |
| Brows (tapered polygons + flick strokes) | `eyebrows/<style>`: mask (+ ink) |
| Nose (bridge curves, plane polygon, nostril ellipses) | `noses/<style>`: shadow, highlight, ink |
| Mouth (lip polygons, mouth ribbon) | `mouths/<style>`: lip mask, shadow, highlight, ink |
| Ears, neck, V-neck shirt | `ears/<size>`, `base/neck`, `kits/v-neck` |
| Hair (silhouette offsets, sawtooth tips, clump ribbons, curl arcs, lock ribbons, fade bands) | `hair/<style>/front` and `/back` |
| Facial hair (jaw-offset polygons, fleck patterns, strand ribbons) | `facialHair/<style>` |
| Freckles, scars, marks, headband, ear stud | `details/<detail>`, `accessories/<item>` |
| Grain and halftone filters | `textures/paper` (+ `textures/halftone`) |

Kept, because it is identity and logic rather than artwork: the stored `Appearance` and its saves/migrations,
deterministic seeded generation, `ageLook` (grey, recession, lines, youth), the option catalogues and the editor,
per-player designed asymmetry (now expressed as small fit transforms), backdrop and kit colour choice, memoisation and
per-instance ids. The landmark system survives as the shared canvas every asset is drawn to.

## 3. Art direction (same illustrator for every asset)

- **References:** the supplied football portraits: confident dark ink, cel-shaded planes with painted edges,
  heavy upper lids, noses built from a side plane and nostrils, lips without outlines, hair as a mass with
  highlight clumps and an irregular edge, a strong neck with the jaw's shadow on it.
- **Ink:** warm near-black `#2a1b14`, never pure black. Weight varies: outer silhouette heaviest, major structure
  medium, small details light. Lines are drawn, slightly imperfect, never ruled.
- **Light:** from the upper left, the same on every asset. The right side of faces, necks and hair masses sits in
  shadow.
- **Shading:** three tones: base, shadow and highlight, as shaped planes with slightly soft painted edges. No airbrushed
  gradients, no photoreal rendering.
- **Hair:** silhouette + hairline + clumps + strand direction, with irregular edges and individually drawn curls,
  locks and braids. Never triangles, rectangles, repeated circles or helmet shapes.
- **Expression:** neutral, focused, serious. Footballers rarely grin.
- **Print feel:** comes last, from the shared texture layer. Every asset must look right without it.
- **Readability:** hair silhouettes and jaw shapes must survive at 48px. Fine strands may vanish; shapes must not.

## 4. The canvas

Every layer is a **512 x 512 transparent PNG**, sRGB, **drawn in place** over the guide
(`art/portrait/guides/canvas-guide.png`). Never crop or offset by hand: the build trims each file and records its
position. The game shows the middle 440 x 512 of the canvas; anything outside that frame may be cropped.

| Landmark | y (px) | Notes |
|---|---|---|
| centre line | x 256 | Faces and pairs are centred on it |
| crown (bare skull) | 72 | Hair rises above it |
| standard hairline | 128 | |
| temple | 200 | head half-width 108 |
| brow | 218 | |
| eye line | 246 | pupils at x 203 and 309 |
| cheekbone | 270 | half-width 118 |
| ears | 223 to 331 | |
| nose base | 327 | |
| mouth | 369 | |
| jaw corner | 385 | half-width 104 |
| chin | 435 | |
| neck | from 400 | half-width 79 |
| collar | 468 | |
| shoulders | 490 | |

**Standard head.** Hair, beards and accessories are drawn on the standard head (the `strong-jaw` face). Each face shape
records how shared art fits it (`FACE_FIT`: skull scale, jaw scale, ear offset, chin offset), so one hairstyle works
on every compatible face. Re-measure those numbers on the delivered face art.

**Pairs.** Eyes, brows and ears are drawn as one file containing both sides, with designed (not mirrored)
differences. The code splits them at the centre line to apply eye spacing, brow angle and ear position, so nothing
but the nose bridge should cross x 256 in those files.

## 5. Layers and how to paint them

| Role | Paint | Composited as |
|---|---|---|
| `mask` | Solid white where the asset has its main colour (hair, skin, beard, shirt). Alpha is coverage; soft edges allowed. | Filled with the chosen colour |
| `secondary-mask` | White where a second colour goes (frosted tips, bleached top, kit trim) | Filled with the secondary colour |
| `iris-mask`, `lip-mask` | White over the iris / lips | Filled with eye colour / lip colour from the skin |
| `white` | Eye whites in their final colour | Normal |
| `shadow` | **Neutral warm grey on transparent**: darker = deeper shadow. No hue from the base colour. | Multiply (strength adjusted per skin tone) |
| `highlight` | **Grey to white on transparent**: lighter = brighter light | Screen |
| `ink` | Final linework and texture in `#2a1b14`, transparent elsewhere | Normal, on top |
| `detail` | Fixed-colour extras that never recolour | Normal |
| `texture` | Paper grain / halftone, full canvas | Multiply at 35%, large sizes only |

Because shading is painted in neutral greys and composited, **any hair colour, skin tone or kit colour keeps the drawn
shading**. Never bake a colour into a hairstyle: platinum, ginger or blue are the same art with a different fill.
Dyed and two-tone styles are presets that reuse another style's art plus its `secondary-mask`.

## 6. Hair specifics

- **front** = everything in front of the face and skull, including the hairline and fringe. **back** = everything
  behind the head and neck (long hair, buns, ponytails, the back of big afros, locks behind the shoulders).
- Hairline: styles marked `supportsExternalHairline: false` draw their own front edge (fringes, curtains, shaved
  patterns). Others will later accept a separate hairline variant (low, normal, high, rounded, straight, widow's peak,
  uneven, mature, receding); draw them with a clean, natural hairline at y 128 for now.
- Fades: draw the density transition (stippled clipper texture thinning into skin) in the mask's alpha and the ink.
  No hard bands.
- Accessories (headbands, hair ties) are separate `accessories/<item>` layers, so long hair can be worn with or
  without them.
- Ageing: short conventional cuts move along mature hairline, receding temples, thinning top, balding crown when the
  player's genes say so (`agedHairstyle`); long, braided, locked and iconic styles keep their art.

## 7. Workflow

1. Draw on the guide, export each layer to `art/portrait/source/<slot>/<role>.png` (slot folders: `components/art/illustrated/slots.ts`).
2. `npm run portraits:assets`: validates (canvas size, transparency, known slot and role, white masks), trims,
   writes `public/portrait/**.webp` and the manifest, and warns on budget.
3. `npm run portraits:sheets` and `npm run portraits:docs`: review the proof-of-concept sheets and the checklist.
4. When a hairstyle passes review, set its `status` to `"ready"` in `engine/appearance/hairstyles.ts`.
5. `npx tsx --tsconfig tsconfig.json scripts/portraits/verify-pipeline.tsx` re-checks colour compositing in Chromium.

## 8. First art test (do this before anything else)

Twelve deliberately different hair structures, plus the minimum face set to show them on different people.
Exact files: [POC_ASSETS.md](portrait-art/POC_ASSETS.md).

| Hairstyle | Structure it proves |
|---|---|
| Shaved | Stipple density on the scalp, natural hairline, no silhouette |
| Textured Crop | Choppy short top, irregular fringe, taper |
| Curly Fade | Individually drawn curls on top, real fade transition |
| Medium Afro | Irregular cloud silhouette from curl clusters, density variation, back layer |
| Classic Cornrows | Individually braided rows, scalp between them |
| Medium Dreads | Individually drawn locks, front and back |
| Classic Curtains | Centre part, strand groups, own hairline |
| Frosted Faux Hawk | Raised textured ridge, secondary colour on tips |
| Brazilian Crescent | A tiny shape that must stay iconic at 48px |
| Classic Mullet | Short front, long back layer on the neck |
| Long Headband | Shoulder-length hair with a separate headband accessory |
| Lion Mane | Enormous curly volume, front and back |

Faces: `strong-jaw` (standard), `long`, `round`, `diamond`. Features: 3 eyes, 3 brows, 3 noses, 3 mouths, medium
ears, neck, V-neck kit, light stubble, short beard, sports headband, paper texture.

**Review before expanding:** all 12 on the same player; several on different faces; hair colours; long hair front/back
layering; 48 / 64 / 96 / 256 px; nothing looks geometric; everything looks drawn by the same illustrator. Only then
draw more styles.

## 9. Performance budget

- WebP, trimmed per layer, so a portrait decodes only the pixels it uses.
- Budget: about 140KB per hairstyle (all layers), about 12MB for the full set. The build warns above that.
- Composition is plain SVG `<image>` layers with a few masks and blend modes. There is no canvas rasterisation and
  no runtime image generation, and it works offline (assets are precached by the service worker; `.webp` is also
  runtime-cached).
- If a long list ever needs many portraits at once, cache a composed bitmap per player and age. That is not needed
  today: one or two portraits are visible per screen.

## 10. Switching over when the art lands

1. Delivered styles become `ready`. The editor and the NPC generator then offer only `ready` styles, using
   `pickHairstyle` (rarity shares common 70%, uncommon 20%, rare 8%, iconic 2%, leaned by age, era and skin tone).
2. A save migration moves `hair` from the stopgap index to library ids (`LEGACY_TO_LIBRARY`).
3. Delete `components/art/portrait/` once every option a player can hold has art.
