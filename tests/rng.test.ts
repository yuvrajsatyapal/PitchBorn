import { describe, expect, it } from "vitest";
import { Rng } from "../src/engine/rng";

describe("Rng", () => {
  it("is deterministic for a seed and restorable from state", () => {
    const a = Rng.fromSeed("x");
    const b = Rng.fromSeed("x");
    const seqA = Array.from({ length: 20 }, () => a.next());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(seqA);
    const c = new Rng(a.state());
    const d = new Rng(a.state());
    expect(c.int(0, 1000)).toBe(d.int(0, 1000));
  });
  it("produces values in range", () => {
    const r = Rng.fromSeed(1);
    for (let i = 0; i < 2000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      expect(r.next()).toBeLessThan(1);
    }
  });
});
