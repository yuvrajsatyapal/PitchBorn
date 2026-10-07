// Portrait cost per size: markup weight, element count and render time.  npx tsx --tsconfig tsconfig.json scripts/portraits/perf.tsx
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerPortrait } from "../../src/components/art/PlayerPortrait";
import { generateAppearance } from "../../src/engine/appearance/generate";
for (const size of [40, 72, 120, 190]) {
  let bytes = 0, els = 0, ms = 0;
  for (let i = 0; i < 100; i++) {
    const a = generateAppearance(`perf-${i}`);
    const t = performance.now();
    const s = renderToStaticMarkup(createElement(PlayerPortrait, { appearance: a, age: 25, size, kit: "#c8102e" }));
    ms += performance.now() - t;
    bytes += s.length; els += (s.match(/<(path|circle|ellipse|rect)/g) || []).length;
  }
  console.log(size, "avg KB", (bytes / 100 / 1024).toFixed(1), "avg elements", Math.round(els / 100), "avg ms", (ms / 100).toFixed(2));
}
