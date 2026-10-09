import type { Appearance } from "@/engine/types";
import type { PortraitModel } from "../portrait/art";
import { hash01 } from "../portrait/geometry";
import { modelFor } from "../portrait/specs";
import type { NextSpec } from "./head";
import { newHairIndex } from "./hair";
import { collarFor, type Collar } from "./kit";

/**
 * Per face shape: how far the cheek falls in under the cheekbone (negative is fullness) and how much the temples
 * narrow. Same order as FACE_SHAPES.
 */
const STRUCTURE: readonly { hollow: number; templeDip: number }[] = [
  /* Oval */ { hollow: 0.3, templeDip: 0.5 },
  /* Round */ { hollow: -0.7, templeDip: 0 },
  /* Square */ { hollow: 0.15, templeDip: 0.3 },
  /* Rectangular */ { hollow: 0.45, templeDip: 0.6 },
  /* Diamond */ { hollow: 0.85, templeDip: 1.7 },
  /* Narrow */ { hollow: 0.6, templeDip: 0.9 },
  /* Broad */ { hollow: -0.25, templeDip: 0.2 },
  /* Long */ { hollow: 0.75, templeDip: 1 },
  /* Heart */ { hollow: 0.35, templeDip: 0.2 },
  /* Strong jaw */ { hollow: 0.55, templeDip: 0.7 },
  /* High cheekbones */ { hollow: 1.05, templeDip: 1.3 },
  /* Soft jaw */ { hollow: -0.45, templeDip: 0.3 },
];

export interface NextModel extends PortraitModel {
  f: NextSpec;
  seed: number;
  collar: Collar;
  /** Optional hairstyle override for the hair proof of concept (styles not yet in the option table). */
  hairStyle?: string;
}

/** The current model plus the extra structure the new renderer draws. Deterministic from the stored appearance. */
export function nextModelFor(a: Appearance, age: number, kit: string, trim: string, background?: string): NextModel {
  const m = modelFor({ ...a, hair: newHairIndex(a.hair) }, age, kit, trim, background);
  const s = STRUCTURE[a.face] ?? STRUCTURE[0];
  const seed = a.aging * 977 + a.face * 31 + a.skin * 7 + 1;
  const v = (i: number) => hash01(seed, i) * 2 - 1;
  const f: NextSpec = {
    ...m.f,
    // Teenage faces carry a little more fullness. The head outline must not change between adult ages (age shows in
    // lines and hair colour, never in the silhouette), so ageing lines no longer hollow the cheek.
    hollow: s.hollow - m.youth * 0.5 + v(1) * 0.12,
    templeDip: s.templeDip + v(2) * 0.2,
    tilt: v(3) * 1.6,
    cheekAsym: v(4) * 1.4,
  };
  return { ...m, f, seed, collar: collarFor(seed) };
}
