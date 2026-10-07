import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { advanceTurn } from "../src/engine/season/advance";
import { decodeState, encodeState } from "../src/persistence/codec";
import { PitchbornDB, setDb } from "../src/persistence/db";
import { migrateState } from "../src/persistence/migrations";
import { deleteSave, exportPayload, listSaves, loadSave, parseImport, saveGame } from "../src/persistence/saves";
import { newCareer } from "./helpers";

const norm = (x: unknown) => JSON.parse(JSON.stringify(x));

describe("save codec", () => {
  it("round-trips losslessly", () => {
    const s = newCareer({ seed: "codec" });
    for (let i = 0; i < 6; i++) advanceTurn(s);
    expect(norm(decodeState(encodeState(s)))).toEqual(norm(s));
  });
  it("is meaningfully smaller than raw JSON", () => {
    const s = newCareer({ seed: "codec2" });
    expect(JSON.stringify(encodeState(s)).length).toBeLessThan(JSON.stringify(s).length * 0.75);
  });
});

describe("migrations", () => {
  it("upgrades a v1 save", () => {
    const s = norm(newCareer({ seed: "mig" }));
    s.schemaVersion = 1;
    delete s.user.trainingHistory;
    delete s.user.rewardCooldowns;
    const m = migrateState(s);
    expect(m.schemaVersion).toBe(3);
    expect(m.user.trainingHistory).toEqual([]);
  });
  it("refuses saves from the future", () => {
    const s = norm(newCareer({ seed: "mig2" }));
    s.schemaVersion = 999;
    expect(() => migrateState(s)).toThrow();
  });
});

describe("IndexedDB saves", () => {
  beforeEach(async () => {
    setDb(new PitchbornDB(`test-${Math.random()}`));
  });
  it("saves, lists, loads and deletes", async () => {
    const s = newCareer({ seed: "db" });
    advanceTurn(s);
    await saveGame(s, { backup: true });
    const list = await listSaves();
    expect(list.map((m) => m.id)).toContain(s.id);
    const { state } = await loadSave(s.id);
    expect(state.turn).toBe(s.turn);
    expect(norm(state.players[s.user.playerId])).toEqual(norm(s.players[s.user.playerId]));
    await deleteSave(s.id);
    expect(await listSaves()).toEqual([]);
  });
  it("recovers from a corrupted primary save using a backup", async () => {
    const { db } = await import("../src/persistence/db");
    const s = newCareer({ seed: "corrupt" });
    await saveGame(s, { backup: true });
    await db().saves.put({ id: s.id, data: { broken: true } as never, updatedAt: "x" });
    const { recovered } = await loadSave(s.id);
    expect(recovered).toBe(true);
  });
  it("exports and imports", () => {
    const s = newCareer({ seed: "export" });
    const back = parseImport(exportPayload(s));
    expect(back.id).toBe(s.id);
    expect(() => parseImport("{\"hello\":1}")).toThrow();
  });
});
