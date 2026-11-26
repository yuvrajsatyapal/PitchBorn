import { describe, expect, it } from "vitest";
import { allTimeRecords, compareEntries, greatestXI, type HallOfFameEntry } from "../src/engine/career/hallOfFame";

const entry = (id: string, position: string, legacy: number, goals: number): HallOfFameEntry => ({
  saveId: id, name: `Player ${id}`, position, positionLong: position, nationality: "ENG", nation: "England", look: {} as HallOfFameEntry["look"], clubId: null, club: "Club",
  clubColors: { primary: "#000", secondary: "#fff" }, span: "2026 – 2040", retiredSeason: 2040, retiredAge: 35, peak: 80 + legacy / 10, legacyScore: legacy, legacyTier: "Great",
  stats: [{ label: "Apps", value: "400" }, { label: "Goals", value: String(goals) }, { label: "Assists", value: "50" }, { label: "Avg rating", value: "7.10" }, { label: "Caps", value: "20" }, { label: "Trophies", value: "5" }],
  honours: [], trophyCount: 5, awards: [], inductedAt: `2026-01-0${id.length}T00:00:00.000Z`,
});

describe("Hall of Fame comparisons", () => {
  const all = [entry("a", "ST", 300, 250), entry("b", "ST", 200, 300), entry("c", "GK", 150, 0), entry("d", "CB", 120, 10), entry("e", "RW", 100, 90)];
  it("compares two careers row by row", () => {
    const rows = compareEntries(all[0], all[1]);
    expect(rows.find((r) => r.label === "Goals")).toMatchObject({ a: 250, b: 300, better: "b" });
    expect(rows.find((r) => r.label === "Legacy")?.better).toBe("a");
    expect(rows.find((r) => r.label === "Avg rating")?.better).toBe("tie");
  });
  it("finds all-time records", () => {
    const recs = allTimeRecords(all);
    expect(recs.find((r) => r.label === "Goals")?.name).toBe("Player b");
    expect(recs.find((r) => r.label === "Legacy")?.name).toBe("Player a");
  });
  it("builds a greatest XI with natural positions first and out-of-position fill-ins", () => {
    const xi = greatestXI(all);
    expect(xi).toHaveLength(11);
    expect(xi[0].entry?.saveId).toBe("c");
    const st = xi.find((s) => s.slot === "ST");
    expect(st?.entry?.saveId).toBe("a");
    expect(new Set(xi.filter((s) => s.entry).map((s) => s.entry!.saveId)).size).toBe(xi.filter((s) => s.entry).length);
    const lw = xi.find((s) => s.slot === "LW");
    expect(lw?.natural).toBe(false);
  });
});
