import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlayerPortrait } from "../src/components/art/PlayerPortrait";
import { ageLook } from "../src/engine/appearance/age";
import { appearanceKey, fromLegacy, generateAppearance, randomizeAppearance, sanitizeAppearance } from "../src/engine/appearance/generate";
import { APPEARANCE_KEYS, COUNTS, FACE_SHAPES, FACIAL_HAIR, HAIR_STYLES } from "../src/engine/appearance/options";
import { Rng } from "../src/engine/rng";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { SCHEMA_VERSION, userPlayer } from "../src/engine/world/helpers";
import type { Appearance, LegacyAppearance } from "../src/engine/types";
import { newCareer } from "./helpers";

const render = (a: Appearance, age = 25, size: number | "small" = 120) => renderToStaticMarkup(createElement(PlayerPortrait, { appearance: a, age, size, kit: "#c8102e" }));

describe("retro portrait style", () => {
  it("favours neutral, focused expressions over grins", () => {
    let smiling = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const m = generateAppearance(`mood-${i}`).mouth;
      if (m === 3 || m === 6) smiling++;
    }
    expect(smiling / N).toBeLessThan(0.15);
  });

  it("gives bald, clean-shaven players different faces (identity is in the face, not the hair)", () => {
    const sigs = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const a = { ...generateAppearance(`bald-${i}`), hair: 0, facial: 0 };
      sigs.add(render(a, 25, 120).replace(/pbp\w*/g, ""));
    }
    expect(sigs.size).toBe(40);
  });

  it("uses unique ids per portrait so clip paths and patterns never collide on a page", () => {
    const one = (k: string) => createElement(PlayerPortrait, { appearance: generateAppearance(k), age: 25, size: 120, kit: "#c8102e" });
    const html = renderToStaticMarkup(createElement("div", null, one("a"), one("b")));
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]).filter((id) => !id.startsWith("pbp-"));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("deterministic generation", () => {
  it("gives the same face for the same seed, every time", () => {
    for (let i = 0; i < 50; i++) expect(generateAppearance(`p-${i}`)).toEqual(generateAppearance(`p-${i}`));
  });

  it("does not make clones: hundreds of players are visually distinct", () => {
    const keys = new Set<string>();
    const N = 600;
    for (let i = 0; i < N; i++) keys.add(appearanceKey(generateAppearance(`player-${i}`)));
    expect(keys.size).toBe(N);
    const faces = new Set<string>();
    for (let i = 0; i < N; i++) {
      const a = generateAppearance(`player-${i}`);
      faces.add([a.face, a.skin, a.eyes, a.nose, a.mouth, a.hair].join("."));
    }
    expect(faces.size / N).toBeGreaterThan(0.97);
  });

  it("only produces valid option indexes and spreads across the options", () => {
    const seen: Record<string, Set<number>> = {};
    for (let i = 0; i < 1500; i++) {
      const a = generateAppearance(`range-${i}`);
      expect(a.v).toBe(2);
      for (const k of APPEARANCE_KEYS) {
        const max = k in COUNTS ? COUNTS[k as keyof typeof COUNTS] - 1 : 100;
        expect(a[k]).toBeGreaterThanOrEqual(0);
        expect(a[k]).toBeLessThanOrEqual(max);
        (seen[k] ??= new Set()).add(a[k]);
      }
    }
    expect(seen.skin.size).toBe(COUNTS.skin);
    expect(seen.face.size).toBe(COUNTS.face);
    expect(seen.hair.size).toBeGreaterThan(HAIR_STYLES.length - 4);
    expect(seen.facial.size).toBeGreaterThan(FACIAL_HAIR.length - 3);
  });

  it("a regional lean nudges odds but never decides the face", () => {
    const dark = Array.from({ length: 1200 }, (_, i) => generateAppearance(`bias-${i}`, { skin: [0, 0, 0, 0, 0.1, 0.9] }).skin);
    const mean = dark.reduce((a, b) => a + b, 0) / dark.length;
    expect(mean).toBeGreaterThan(5);
    expect(new Set(dark).size).toBe(COUNTS.skin);
    expect(dark.filter((s) => s <= 2).length).toBeGreaterThan(0);
  });

  it("randomize keeps identity when only the hair is rolled", () => {
    const a = generateAppearance("keep");
    const b = randomizeAppearance(a, "hair", Rng.fromSeed("x"));
    for (const k of ["skin", "face", "eyes", "nose", "mouth", "headW", "headH", "eyeSp", "noseSc", "aging"] as const) expect(b[k]).toBe(a[k]);
    const c = randomizeAppearance(a, "face", Rng.fromSeed("y"));
    expect(c.hair).toBe(a.hair);
    expect(c.facial).toBe(a.facial);
  });
});

describe("ageing", () => {
  it("only changes age-driven properties, monotonically, and never the identity fields", () => {
    for (let i = 0; i < 40; i++) {
      const a = generateAppearance(`age-${i}`);
      const before = JSON.stringify(a);
      let prev = ageLook(a, 16);
      for (let age = 17; age <= 45; age++) {
        const cur = ageLook(a, age);
        expect(cur.grey).toBeGreaterThanOrEqual(prev.grey);
        expect(cur.lines).toBeGreaterThanOrEqual(prev.lines);
        expect(cur.recede).toBeGreaterThanOrEqual(prev.recede);
        expect(cur.youth).toBeLessThanOrEqual(prev.youth);
        prev = cur;
      }
      expect(JSON.stringify(a)).toBe(before);
    }
    const a = generateAppearance("young");
    expect(ageLook(a, 19).grey).toBe(0);
    expect(ageLook(a, 19).lines).toBe(0);
    expect(ageLook(a, 55).grey).toBeGreaterThan(0.5);
  });

  it("a face stays recognisable: the same face parts are drawn at 20 and 38", () => {
    const a = generateAppearance("same-guy");
    const young = render(a, 20);
    const old = render(a, 38);
    expect(young).not.toBe(old);
    // Face outline comes from the contour alone, so it is identical at every age.
    const face = (s: string) => s.match(/<path d="(M[^"]+)" fill="#[0-9a-f]{6}" stroke="#1b1712" stroke-width="2.8"/)?.[1];
    expect(face(young)).toBeTruthy();
    expect(face(young)).toBe(face(old));
  });
});

describe("rendering never breaks", () => {
  const bad = (svg: string) => /NaN|undefined|Infinity|null/.test(svg);

  it("renders every hairstyle on every face shape with every facial hair", () => {
    const base = generateAppearance("sweep");
    for (let h = 0; h < HAIR_STYLES.length; h++) {
      for (let f = 0; f < FACE_SHAPES.length; f += 2) {
        const svg = render({ ...base, hair: h, face: f, facial: (h + f) % FACIAL_HAIR.length }, 20 + h);
        expect(bad(svg), `hair ${h} face ${f}`).toBe(false);
      }
    }
    for (let b = 0; b < FACIAL_HAIR.length; b++) expect(bad(render({ ...base, facial: b })), `beard ${b}`).toBe(false);
  });

  it("renders every option along every axis, at the extremes of the fine-tuning ranges", () => {
    const base = generateAppearance("axes");
    for (const k of Object.keys(COUNTS) as (keyof typeof COUNTS)[]) {
      for (let v = 0; v < COUNTS[k]; v++) {
        for (const g of [0, 100]) {
          const a = { ...base, [k]: v, headW: g, headH: 100 - g, eyeSp: g, browAng: g, noseSc: g, earSc: 100 - g };
          expect(bad(render(a, 30)), `${k}=${v} geo ${g}`).toBe(false);
        }
      }
    }
  });

  it("random faces render at every size and age", () => {
    for (let i = 0; i < 200; i++) {
      const a = generateAppearance(`fuzz-${i}`);
      for (const size of ["small", 72, 190] as const) expect(bad(render(a, 16 + (i % 30), size))).toBe(false);
    }
  });

  it("small portraits skip the expensive effects", () => {
    const a = generateAppearance("small");
    expect(render(a, 25, "small")).not.toContain("filter=\"url(#pbp-ink)\"");
    expect(render(a, 25, 190)).toContain("filter=\"url(#pbp-grain)\"");
    expect(render(a, 25, 190).length).toBeGreaterThan(render(a, 25, "small").length);
  });
});

describe("saves", () => {
  it("round-trips the full appearance through the codec", () => {
    const s = newCareer({ seed: "look-codec" });
    const back = decodeState(JSON.parse(JSON.stringify(encodeState(s))));
    for (const p of Object.values(s.players).slice(0, 80)) expect(back.players[p.id].look).toEqual(p.look);
  });

  it("every generated player already has a stable face tied to their id", () => {
    const a = newCareer({ seed: "look-world" });
    const b = newCareer({ seed: "look-world" });
    for (const p of Object.values(a.players).slice(0, 100)) {
      if (p.isUser) continue;
      expect(p.look).toEqual(b.players[p.id].look);
      expect(p.look.v).toBe(2);
    }
  });

  it("upgrades the old five-value avatar, keeping the player's choices", () => {
    const old: LegacyAppearance = { skin: 4, hair: 5, hairColor: 3, facial: 2, eyes: 1 };
    const a = fromLegacy(old, "pid-1");
    expect(a).toEqual(fromLegacy(old, "pid-1"));
    expect(a.skin).toBeGreaterThan(5);
    expect(a.facial).toBe(3);
    expect(sanitizeAppearance(a)).toEqual(a);
  });

  it("migrates a v5 save with legacy looks and a legacy codec payload", () => {
    const s = newCareer({ seed: "look-mig" });
    const legacy: LegacyAppearance = { skin: 2, hair: 1, hairColor: 1, facial: 0, eyes: 1 };
    const raw = JSON.parse(JSON.stringify(s));
    raw.schemaVersion = 5;
    for (const p of Object.values(raw.players) as { look: unknown }[]) p.look = { ...legacy };
    const migrated = migrateState(raw);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    const u = userPlayer(migrated);
    expect(u.look.v).toBe(2);
    expect(u.look.hair).toBe(2);
  });
});
