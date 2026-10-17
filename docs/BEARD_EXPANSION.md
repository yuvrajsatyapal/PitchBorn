# Beard expansion: four new facial-hair styles

Imperial Goatee, Sharp Chinstrap, Maestro Beard and Rising Stubble. Built on the existing renderer
(`src/components/art/portrait-next/`): same anchors, same `beardTones`, same size-aware detail levels, same registry.
**Status: implemented, awaiting visual approval. Not approved.**

## Existing architecture reused

- **Registry:** `FACIAL_HAIR` in `src/engine/appearance/options.ts`. Indices are append-only (saves store the index). The new
  styles are 16-19. The generator's `FACIAL_ODDS` still has 16 entries, so the new styles are **editor-only**: no seed
  rolls them, global rarity and every saved or generated look are unchanged.
- **Dispatch:** `art.tsx` draws styles 1-2 with `StubbleNext` (a tone wash under the features) and everything else with
  `BeardNext` over the features. `BeardNext` sends styles with a body to `BeardMass` (`beardMass.tsx`: boxed, long, chin,
  goatee, ring) and the rest to shared `Growth` regions (`growthFor`).
- **Anchors:** `burnY` (bottom of the hair's sideburn), `head.rightPts/leftPts` outline, `mouthGap`, `a.mouthL/R`,
  `a.cheekL/R`, `f.nose.w`, `f.chinW/chinY/chinH/jawW`. Nothing uses absolute coordinates.
- **Tone:** `beardTones(colour, skin)` (base / shade / deep / light / edge). Outer silhouette is the only strong line.
- **Variation:** seeds from face geometry and the player's `seed` (hidden `aging` gene) through `hash01` / `noise1`.
- **Size:** `d` 0 (under 72px), 1 (under 140px), 2 (large); `lodNow()` inside geometry.
- **Closest existing styles:** Goatee/Moustache+goatee (5, 6), Chinstrap (15), Full/Long beard (10, 11), Light/Heavy stubble (1, 2).

## Analysis (before implementation)

| | Imperial Goatee | Sharp Chinstrap | Maestro Beard | Rising Stubble |
|---|---|---|---|---|
| Silhouette | moustache + narrow connectors + elongated chin tuft; cheeks and jaw clean | one thin band, sideburn to sideburn, along the jaw | medium full beard, chin visibly longer than the sides, rounded taper | no outline: broken patches of short hair, chin and lip strongest |
| Cheek coverage | none | none (upper edge sharp, under the sideburn) | moderate, soft irregular upper edge | very sparse, lower cheeks only |
| Jaw coverage | none past the chin corners | the whole jaw line, thin | full lower jaw | light, three broken segments |
| Chin | 12-20 units below the lip, narrower than the chin at the top, fuller then tapering, uneven lower edge | slight fullness, no extension | hangs 14-20 below the outline, gentle taper | moderate density, never a solid tuft |
| Moustache | prominent, curved, tapered ends, asymmetric, clear lip | none | natural, joined to the cheek mass | thin, incomplete, gap in the middle |
| Sideburn connection | none (clean cheeks) | band starts at the hair's sideburn point (`burnY`) | cheek line starts at `burnY` | light patch at the sideburn |
| Density | high on moustache and chin | medium, even | medium-high, wavy | low, uneven, nonuniform |
| Growth direction | moustache: outward and down; chin: down | along the jaw (down and forward) | down and slightly outward, small bend | short marks pointing down on the chin, outward on the lip |
| Edge irregularity | lower chin edge, moustache tips | lower edge restrained, upper edge crisp | lower edge uneven with 4-6 clumps, no repeating triangles | no edge: soft patches |
| Main masses | moustache, two connectors, chin mass, 2-4 clumps | single band | cheek masses, moustache, jaw masses, chin mass, lower clumps (one outline, overlapping) | chin, lip, jaw, cheek, sideburn patches |
| Closest existing / difference | Moustache + goatee: that is a wide ring with the lip surrounded and a short chin; here the connectors are thin, the chin is longer and tapered | Chinstrap (15): that is a soft tapered line that fades out before the ears; this starts at the sideburn, has even width and a crisp upper edge. Short/Full beard: those have cheek fill | Full beard: boxed, no extension, regular edge. Long beard: far longer | Light stubble: even wash over the whole lower face; this is patchy, concentrated, with visible hair marks |
| Face fitting | connector reach and chin width follow `chinW` and mouth width; length capped by chin height | follows `head` outline pushed 1.4 out; width scaled to jaw width | cheek line from cheek anchors; chin extension clamped, never scaled by chin length | patches placed from mouth, chin and jaw anchors |
| At 48px | moustache, two thin connectors, chin mass | 2px band that joins at the chin | silhouette with the extended chin | 3-4 value clusters, no marks |
| Primitives | `chinMass` shape "imperial", imperial moustache growth | `strap`-like growth with `crisp` flag | `longMass`-like with lobed lower contour | `RisingStubbleNext` density patches + marks in one path |
