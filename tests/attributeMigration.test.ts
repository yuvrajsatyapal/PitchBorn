import { describe, expect, it } from "vitest";
import { expandAllAttributes, expandAttributes, lacksAddedAttributes } from "../src/engine/players/expansion";
import { overallFor } from "../src/engine/players/attributes";
import { legacyOverall } from "../src/engine/players/model";
import { EXTRA_REQ } from "../src/engine/traits/attributeModel";
import { ADDED_ATTRS, LEGACY_ATTRS, type GameState, type Player } from "../src/engine/types";
import { advanceTurn } from "../src/engine/season/advance";
import { checkInvariants } from "../src/engine/validate";
import { SCHEMA_VERSION } from "../src/engine/world/helpers";
import { decodeState, encodeState, type EncodedState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { newCareer } from "./helpers";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** A save as schema 14 stored it: twenty attributes per player, positional, and the old version number. */
function asSchema14(state: GameState): EncodedState {
  const enc = clone(encodeState(state));
  for (const p of enc.players) p.attrs = p.attrs.slice(0, LEGACY_ATTRS.length);
  enc.schemaVersion = 14;
  return enc;
}

const open14 = (enc: EncodedState): GameState => migrateState(decodeState(clone(enc)) as unknown as Record<string, unknown>);

describe("opening a schema-14 save", () => {
  const source = newCareer({ seed: "mig-attrs", position: "CM" });
  for (let i = 0; i < 40; i++) advanceTurn(source);
  const enc = asSchema14(source);
  const opened = open14(enc);

  it("is migrated to the current schema and gives everyone the new attributes", () => {
    expect(opened.schemaVersion).toBe(SCHEMA_VERSION);
    const players = Object.values(opened.players);
    expect(players.length).toBeGreaterThan(500);
    for (const p of players) {
      expect(lacksAddedAttributes(p), p.id).toBe(false);
      for (const k of ADDED_ATTRS) {
        expect(p.attrs[k], `${p.id} ${k}`).toBeGreaterThanOrEqual(1);
        expect(p.attrs[k], `${p.id} ${k}`).toBeLessThanOrEqual(99);
      }
    }
  });

  it("keeps every original attribute and the player's whole identity exactly", () => {
    for (const before of Object.values(source.players)) {
      const after = opened.players[before.id];
      expect(after, before.id).toBeDefined();
      for (const k of LEGACY_ATTRS) expect(after.attrs[k], `${before.id} ${k}`).toBe(before.attrs[k]);
      expect(after.hidden).toEqual(before.hidden);
      expect(after.position).toBe(before.position);
      expect(after.secondary).toEqual(before.secondary);
      expect(after.birthYear).toBe(before.birthYear);
      expect(after.firstName + after.lastName).toBe(before.firstName + before.lastName);
      expect(after.career).toEqual(before.career);
      expect(after.history).toEqual(before.history);
      expect(after.focus).toEqual(before.focus);
      expect(after.look).toEqual(before.look);
      expect(after.clubId).toBe(before.clubId);
    }
  });

  it("does not add, remove or change a single trait", () => {
    for (const before of Object.values(source.players)) {
      const after = opened.players[before.id];
      // Loading re-orders a player's traits (strongest first); nothing else about them may change.
      const key = (ts: Player["traits"]) => [...(ts ?? [])].sort((a, b) => a.id.localeCompare(b.id));
      expect(key(after.traits), before.id).toEqual(key(before.traits));
    }
  });

  it("leaves every player's overall within one point of what it was", () => {
    let worst = 0;
    for (const before of Object.values(source.players)) {
      const after = opened.players[before.id];
      const was = Math.round(legacyOverall(before.attrs, before.position));
      const now = overallFor(after.attrs, after.position);
      worst = Math.max(worst, Math.abs(now - was));
      expect(Math.abs(now - was), `${before.id} ${before.position}`).toBeLessThanOrEqual(1);
    }
    expect(worst).toBeLessThanOrEqual(1);
  });

  it("keeps the traits a player holds valid under the new requirements", () => {
    for (const p of Object.values(opened.players)) {
      for (const t of p.traits ?? []) {
        for (const r of EXTRA_REQ[t.id] ?? []) expect(p.attrs[r.attr], `${p.id} ${t.id} needs ${r.attr}`).toBeGreaterThanOrEqual(r.min);
      }
    }
  });

  it("is deterministic, and does not depend on the order players are visited in", () => {
    const again = open14(enc);
    expect(clone(again.players)).toEqual(clone(opened.players));
    const reversed = clone(enc);
    reversed.players.reverse();
    const third = open14(reversed);
    for (const id of Object.keys(opened.players)) expect(third.players[id].attrs, id).toEqual(opened.players[id].attrs);
  });

  it("is idempotent: opening it again, or expanding again, changes nothing", () => {
    const before = clone(opened.players);
    expandAllAttributes(opened);
    expect(clone(opened.players)).toEqual(before);
    const reopened = migrateState(clone(opened) as unknown as Record<string, unknown>);
    expect(clone(reopened.players)).toEqual(before);
    const p = Object.values(opened.players)[0];
    expect(expandAttributes(p, opened.season)).toBe(false);
  });

  it("gives the new attributes sensible values for the role (strikers move, centre-backs mark, keepers come off their line)", () => {
    const by = (pos: string) => Object.values(opened.players).filter((p) => p.position === pos && !p.virtual);
    const avg = (ps: Player[], k: (typeof ADDED_ATTRS)[number]) => ps.reduce((s, p) => s + p.attrs[k], 0) / ps.length;
    expect(avg(by("ST"), "offBall")).toBeGreaterThan(avg(by("CB"), "offBall") + 15);
    expect(avg(by("CB"), "marking")).toBeGreaterThan(avg(by("ST"), "marking") + 15);
    expect(avg(by("GK"), "oneOnOnes")).toBeGreaterThan(avg(by("ST"), "oneOnOnes") + 25);
  });

  it("plays on without a problem: a few weeks later nothing is missing, NaN or out of range", () => {
    for (let i = 0; i < 6; i++) advanceTurn(opened);
    for (const p of Object.values(opened.players)) {
      for (const k of [...LEGACY_ATTRS, ...ADDED_ATTRS]) {
        expect(Number.isFinite(p.attrs[k]), `${p.id} ${k}`).toBe(true);
        expect(p.attrs[k]).toBeGreaterThanOrEqual(1);
        expect(p.attrs[k]).toBeLessThanOrEqual(99);
      }
    }
    expect(checkInvariants(opened).issues).toEqual([]);
  });
});

describe("older saves go through the whole chain", () => {
  it("a schema-13 save opens and ends up on the same footing", () => {
    const s = newCareer({ seed: "mig-attrs-13" });
    const enc = asSchema14(s);
    enc.schemaVersion = 13;
    const opened = open14(enc);
    expect(opened.schemaVersion).toBe(SCHEMA_VERSION);
    for (const p of Object.values(opened.players)) expect(lacksAddedAttributes(p), p.id).toBe(false);
  });

  it("a current save round-trips through the codec with all thirty-three attributes", () => {
    const s = newCareer({ seed: "mig-attrs-rt" });
    const back = decodeState(clone(encodeState(s)));
    expect(clone(back.players)).toEqual(clone(s.players));
  });

  it("filling in a single player's attributes only needs that player", () => {
    const s = newCareer({ seed: "mig-attrs-one" });
    const p = clone(Object.values(s.players).find((x) => x.position === "CB" && !x.virtual) as Player);
    const was = Math.round(legacyOverall(p.attrs, p.position));
    for (const k of ADDED_ATTRS) delete (p.attrs as Partial<Record<(typeof ADDED_ATTRS)[number], number>>)[k];
    expect(lacksAddedAttributes(p)).toBe(true);
    expect(expandAttributes(p, s.season)).toBe(true);
    expect(overallFor(p.attrs, p.position)).toBeGreaterThanOrEqual(was - 1);
    expect(overallFor(p.attrs, p.position)).toBeLessThanOrEqual(was + 1);
  });
});
