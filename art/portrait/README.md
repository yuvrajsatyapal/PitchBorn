# Portrait artwork (source)

Hand-drawn source layers for player portraits. Read docs/PORTRAIT_ART.md first.

- `guides/canvas-guide.png`: the 512 x 512 master canvas with landmarks. Draw every layer in place over it.
- `source/<slot>/<role>.png`: delivered layers, e.g. `source/hair/medium-afro/front/mask.png`.
  The slot folders and their layers are listed in docs/portrait-art/POC_ASSETS.md (first art test) and
  `src/components/art/illustrated/slots.ts` (everything).
- `npm run portraits:assets` turns these into `public/portrait/**.webp` and the manifest the game reads.

No artwork has been delivered yet.
