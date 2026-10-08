import { describe, expect, it } from "vitest";
import { expireDecisions, resolveDecision } from "../src/engine/career/events";
import { advanceTurn, simUserMatch } from "../src/engine/season/advance";
import { MAX_DEFERRALS, DECLINE_COOLDOWN, DEFER_WEEKS, EXPIRE_COOLDOWN, INVITE_LIFETIME, outlookFor, stepInvitations } from "../src/engine/national/allegiance";
import { canSwitchAllegiance, commitment, eligibleTeams, intlTeam, sanitizeIntl } from "../src/engine/national/identity";
import { selectNationalSquads } from "../src/engine/national/national";
import { applyMatchResult } from "../src/engine/season/matchday";
import { Rng } from "../src/engine/rng";
import type { Fixture, GameState } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { newCareer } from "./helpers";

const ALWAYS = { chance: () => true, next: () => 0.5 } as unknown as Rng;
const NEVER = { chance: () => false, next: () => 0.5 } as unknown as Rng;

/** A French citizen born in Morocco, good enough that both nations would pick them. */
function dual(seed: string): GameState {
  const s = newCareer({ seed, nationality: "FRA", birthCountry: "MAR", countries: ["ENG"] });
  const p = userPlayer(s);
  for (const k of Object.keys(p.attrs)) (p.attrs as Record<string, number>)[k] = 84;
  p.form = 7.4;
  return s;
}

/** Puts the world at an invitation check turn with nothing in the way. */
function atCheck(s: GameState, turn = 11) {
  s.turn = turn;
  s.turnIndex = 100;
  const st = (s.user.intl ??= { history: [], cooldownUntil: 0 });
  st.cooldownUntil = 0;
}

const openInvite = (s: GameState) => {
  atCheck(s);
  selectNationalSquads(s);
  stepInvitations(s, ALWAYS);
  return s.user.intl?.invitation;
};

describe("identity: birth country is not allegiance", () => {
  it("keeps citizenship, birth eligibility and allegiance apart", () => {
    const s = dual("al-id");
    const p = userPlayer(s);
    expect(p.nationality).toBe("FRA");
    expect(p.altNationality).toBe("MAR");
    expect(intlTeam(p)).toBe("FRA");
    expect(eligibleTeams(p)).toEqual(["FRA", "MAR"]);
    expect(commitment(p)).toBe("open");
  });

  it("never switches the user to the birth country on its own, however long the career runs", () => {
    const s = dual("al-auto");
    const p = userPlayer(s);
    for (let i = 0; i < 90; i++) {
      advanceTurn(s);
      if (s.user.decisions.some((d) => d.intlCode)) for (const d of s.user.decisions.filter((x) => x.intlCode)) resolveDecision(s, d.id, "later");
    }
    expect(intlTeam(p)).toBe("FRA");
    expect(p.intl.tiedTo === undefined || p.intl.tiedTo === "FRA").toBe(true);
    expect(s.nationalTeams.MAR.squad).not.toContain(p.id);
  });

  it("selection only ever considers the nation the user chose", () => {
    const s = dual("al-sel");
    const p = userPlayer(s);
    selectNationalSquads(s);
    expect(s.nationalTeams.MAR.squad).not.toContain(p.id);
    p.intl.allegiance = "MAR";
    p.intl.switches = 1;
    selectNationalSquads(s);
    expect(s.nationalTeams.FRA.squad).not.toContain(p.id);
  });
});

describe("invitations", () => {
  it("come from the other eligible nation, with football reasons, and wait for an answer", () => {
    const s = dual("al-inv");
    const inv = openInvite(s);
    expect(inv?.code).toBe("MAR");
    expect(inv?.reasons.length).toBeGreaterThan(0);
    const d = s.user.decisions.find((x) => x.intlCode);
    expect(d?.options.map((o) => o.id)).toEqual(["accept", "decline", "later"]);
    expect(d?.fallback).toBe("later");
    expect(d?.body).toMatch(/permanent|once/i);
    expect(intlTeam(userPlayer(s))).toBe("FRA");
  });

  it("are never made to someone with no second eligibility", () => {
    const s = newCareer({ seed: "al-single", nationality: "ENG", birthCountry: "ENG" });
    for (const k of Object.keys(userPlayer(s).attrs)) (userPlayer(s).attrs as Record<string, number>)[k] = 84;
    expect(openInvite(s)).toBeUndefined();
  });

  it("accepting switches allegiance, keeps birth and citizenship, records history and gives no cap", () => {
    const s = dual("al-acc");
    openInvite(s);
    const d = s.user.decisions.find((x) => x.intlCode)!;
    const caps = userPlayer(s).intl.caps;
    resolveDecision(s, d.id, "accept");
    const p = userPlayer(s);
    expect(intlTeam(p)).toBe("MAR");
    expect(p.nationality).toBe("FRA");
    expect(p.altNationality).toBe("MAR");
    expect(p.intl.switches).toBe(1);
    expect(p.intl.caps).toBe(caps);
    expect(p.intl.tiedTo).toBeUndefined();
    expect(s.user.intl?.invitation).toBeUndefined();
    expect(s.user.intl?.history.at(-1)?.outcome).toBe("accepted");
    expect(s.user.timeline.some((t) => t.kind === "international" && /Chose to represent/.test(t.title))).toBe(true);
    expect(s.user.memories.some((m) => m.kind === "career-decision" && m.data?.event === "intl-allegiance")).toBe(true);
    expect(s.news.some((n) => /You will represent/.test(n.title))).toBe(true);
    selectNationalSquads(s);
    expect(s.nationalTeams.FRA.squad).not.toContain(p.id);
  });

  it("accepting twice cannot record two memories or two switches", () => {
    const s = dual("al-acc2");
    openInvite(s);
    const d = s.user.decisions.find((x) => x.intlCode)!;
    resolveDecision(s, d.id, "accept");
    const memories = s.user.memories.length;
    resolveDecision(s, d.id, "accept");
    expect(s.user.memories.length).toBe(memories);
    expect(userPlayer(s).intl.switches).toBe(1);
  });

  it("declining keeps the allegiance and starts a cooldown", () => {
    const s = dual("al-dec");
    openInvite(s);
    const d = s.user.decisions.find((x) => x.intlCode)!;
    resolveDecision(s, d.id, "decline");
    expect(intlTeam(userPlayer(s))).toBe("FRA");
    expect(s.user.intl?.history.at(-1)?.outcome).toBe("declined");
    expect(s.user.intl?.cooldownUntil).toBe(s.turnIndex + DECLINE_COOLDOWN);
    // Not asked again until the cooldown has passed.
    atCheck(s, 16);
    s.user.intl!.cooldownUntil = s.turnIndex + 10;
    stepInvitations(s, ALWAYS);
    expect(s.user.intl?.invitation).toBeUndefined();
  });

  it("a declined nation needs a material change before asking again", () => {
    const s = dual("al-mat");
    openInvite(s);
    resolveDecision(s, s.user.decisions.find((x) => x.intlCode)!.id, "decline");
    const p = userPlayer(s);
    s.turnIndex += DECLINE_COOLDOWN + 5;
    s.turn = 16;
    s.user.intl!.cooldownUntil = 0;
    stepInvitations(s, ALWAYS);
    expect(s.user.intl?.invitation).toBeUndefined(); // same ability, not enough time passed
    for (const k of Object.keys(p.attrs)) (p.attrs as Record<string, number>)[k] = 92;
    stepInvitations(s, ALWAYS);
    expect(s.user.intl?.invitation?.code).toBe("MAR");
  });

  it("deciding later keeps the allegiance, comes back, and lapses after the last deferral", () => {
    const s = dual("al-later");
    openInvite(s);
    for (let i = 0; i <= MAX_DEFERRALS; i++) {
      const d = s.user.decisions.find((x) => x.intlCode);
      expect(d).toBeTruthy();
      resolveDecision(s, d!.id, "later");
      expect(intlTeam(userPlayer(s))).toBe("FRA");
      if (s.user.intl?.invitation) {
        expect(s.user.decisions.some((x) => x.intlCode)).toBe(false);
        s.turnIndex = s.user.intl.invitation.returnIndex ?? s.turnIndex;
        stepInvitations(s, NEVER);
      }
    }
    expect(s.user.intl?.invitation).toBeUndefined();
    expect(s.user.intl?.history.at(-1)?.outcome).toBe("expired");
    expect(s.user.intl?.cooldownUntil).toBeGreaterThan(0);
    expect(DEFER_WEEKS * (MAX_DEFERRALS + 1)).toBeLessThanOrEqual(INVITE_LIFETIME + DEFER_WEEKS);
  });

  it("an unanswered invitation is never accepted for the user: expiry rules resolve to 'later'", () => {
    const s = dual("al-ignore");
    openInvite(s);
    const d = s.user.decisions.find((x) => x.intlCode)!;
    s.turn = d.expiresTurn + 1;
    expireDecisions(s);
    expect(intlTeam(userPlayer(s))).toBe("FRA");
    expect(userPlayer(s).intl.switches ?? 0).toBe(0);
    // And with nobody answering at all, it lapses.
    s.turnIndex = (s.user.intl?.invitation?.expiresIndex ?? 0) + 1;
    s.user.decisions = [];
    stepInvitations(s, NEVER);
    expect(s.user.intl?.invitation).toBeUndefined();
    expect(s.user.intl?.history.at(-1)?.outcome).toBe("expired");
    expect(s.user.intl?.cooldownUntil).toBe(s.turnIndex + EXPIRE_COOLDOWN);
  });

  it("is not made every week: one pending at a time, only on check turns, with a cooldown", () => {
    const s = dual("al-freq");
    atCheck(s, 7); // not a check turn
    stepInvitations(s, ALWAYS);
    expect(s.user.intl?.invitation).toBeUndefined();
    openInvite(s);
    const count = s.user.decisions.filter((d) => d.intlCode).length;
    s.turn = 16;
    stepInvitations(s, ALWAYS);
    expect(s.user.decisions.filter((d) => d.intlCode).length).toBe(count);
  });

  it("is dropped if the user becomes cap-tied or retires from internationals", () => {
    const s = dual("al-stale");
    openInvite(s);
    userPlayer(s).intl.tiedTo = "FRA";
    stepInvitations(s, ALWAYS);
    expect(s.user.intl?.invitation).toBeUndefined();
    expect(s.user.decisions.some((d) => d.intlCode)).toBe(false);
  });
});

describe("selection and outlook", () => {
  it("measures the user against the real eligible pool of each nation", () => {
    const s = dual("al-out");
    const fra = outlookFor(s, "FRA");
    const mar = outlookFor(s, "MAR");
    expect(fra.pool).toBeGreaterThan(0);
    expect(mar.pool).toBeGreaterThan(0);
    expect(fra.group).toBe("ATT");
    expect(["strong", "fringe", "unlikely"]).toContain(mar.tier);
    // Ability moves the outlook.
    const p = userPlayer(s);
    for (const k of Object.keys(p.attrs)) (p.attrs as Record<string, number>)[k] = 40;
    expect(outlookFor(s, "FRA").rank).toBeGreaterThanOrEqual(fra.rank);
  });

  it("calls the user up for the nation they represent, with no reconfirmation", () => {
    const s = dual("al-call");
    const p = userPlayer(s);
    for (const k of Object.keys(p.attrs)) (p.attrs as Record<string, number>)[k] = 95;
    p.reputation = 90;
    selectNationalSquads(s);
    expect(s.nationalTeams.FRA.squad).toContain(p.id);
    expect(s.user.decisions.some((d) => d.intlCode)).toBe(false);
  });
});

describe("caps and cap-ties", () => {
  const fixture = (home: string, away: string, stage: string): Fixture => ({ id: `f-${stage}-${home}`, compId: "intl-test", round: 1, turn: 9, home, away, stage });
  const res = (s: GameState, f: Fixture) => {
    const p = userPlayer(s);
    const comp = { id: "intl-test", kind: "international", name: "International", shortName: "INT", season: s.season, teams: [f.home, f.away], fixtures: [f], prestige: 3, complete: false } as unknown as GameState["competitions"][string];
    s.competitions["intl-test"] = comp;
    applyMatchResult(s, f, { homeGoals: 1, awayGoals: 0, extraTime: false, goals: [], lines: [{ id: p.id, side: f.home === intlTeam(p) ? "home" : "away", slot: "ST", started: true, minuteOn: 0, minuteOff: 90, rating: 7, goals: 0, assists: 0, shots: 0, onTarget: 0, keyPasses: 0, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0 }], events: [], stats: { possession: [50, 50], shots: [1, 1], onTarget: [0, 0], xg: [0, 0], corners: [0, 0], fouls: [0, 0], yellows: [0, 0], reds: [0, 0] }, motm: p.id, injuries: [] } as never, Rng.fromSeed("cap"));
  };

  it("a friendly cap counts as a cap but does not make the choice binding", () => {
    const s = dual("cap-fr");
    const p = userPlayer(s);
    res(s, fixture("FRA", "BRA", "Friendly"));
    expect(p.intl.caps).toBe(1);
    expect(p.intl.compCaps ?? 0).toBe(0);
    expect(p.intl.tiedTo).toBeUndefined();
    expect(commitment(p)).toBe("provisional");
    expect(canSwitchAllegiance(p).ok).toBe(true);
  });

  it("a competitive cap makes it binding and closes the door on switching", () => {
    const s = dual("cap-comp");
    const p = userPlayer(s);
    res(s, fixture("FRA", "BRA", "Qualifier"));
    expect(p.intl.tiedTo).toBe("FRA");
    expect(p.intl.compCaps).toBe(1);
    expect(commitment(p)).toBe("binding");
    expect(canSwitchAllegiance(p).ok).toBe(false);
    p.intl.tiedTo = "FRA";
    expect(openInvite(s)).toBeUndefined();
  });

  it("caps come only from matches actually played: saying yes adds none", () => {
    const s = dual("cap-yes");
    openInvite(s);
    resolveDecision(s, s.user.decisions.find((x) => x.intlCode)!.id, "accept");
    expect(userPlayer(s).intl.caps).toBe(0);
    expect(userPlayer(s).intl.debutSeason).toBeUndefined();
    res(s, fixture("MAR", "BRA", "Friendly"));
    expect(userPlayer(s).intl.caps).toBe(1);
  });

  it("allows only one switch", () => {
    const s = dual("cap-one");
    openInvite(s);
    resolveDecision(s, s.user.decisions.find((x) => x.intlCode)!.id, "accept");
    expect(canSwitchAllegiance(userPlayer(s)).ok).toBe(false);
    s.user.intl!.cooldownUntil = 0;
    atCheck(s, 16);
    stepInvitations(s, ALWAYS);
    expect(s.user.intl?.invitation).toBeUndefined();
  });

  it("too many friendly caps closes the door too", () => {
    const s = dual("cap-many");
    userPlayer(s).intl.caps = 4;
    expect(canSwitchAllegiance(userPlayer(s)).ok).toBe(false);
  });
});

describe("saves and old careers", () => {
  it("survives a save and reload with an invitation pending", () => {
    const s = dual("sv-1");
    openInvite(s);
    const back = migrateState(JSON.parse(JSON.stringify(decodeState(encodeState(s)))));
    expect(back.user.intl?.invitation?.code).toBe("MAR");
    expect(back.user.decisions.filter((d) => d.intlCode).length).toBe(1);
    resolveDecision(back, back.user.decisions.find((x) => x.intlCode)!.id, "accept");
    const again = migrateState(JSON.parse(JSON.stringify(decodeState(encodeState(back)))));
    expect(intlTeam(again.players[again.user.playerId])).toBe("MAR");
  });

  it("keeps an established international career and does not infer a switch from birthplace", () => {
    const s = JSON.parse(JSON.stringify(dual("sv-2")));
    s.schemaVersion = 9;
    const u = s.players[s.user.playerId];
    u.intl = { caps: 12, goals: 3, retired: false, debutSeason: 2026, tiedTo: "MAR" };
    const m = migrateState(s);
    const p = m.players[m.user.playerId];
    expect(p.intl.caps).toBe(12);
    expect(intlTeam(p)).toBe("MAR"); // history says Morocco: kept
    expect(p.intl.tiedTo).toBe("MAR");
    const s2 = JSON.parse(JSON.stringify(dual("sv-3")));
    s2.schemaVersion = 9;
    s2.players[s2.user.playerId].intl = { caps: 0, goals: 0, retired: false };
    const m2 = migrateState(s2);
    expect(intlTeam(m2.players[m2.user.playerId])).toBe("FRA"); // born in Morocco, but nothing says they chose it
  });

  it("sanitises contradictory international fields", () => {
    const s = dual("sv-4");
    const p = userPlayer(s);
    p.intl.tiedTo = "BRA"; // a nation they have no claim to
    p.intl.caps = 3;
    p.intl.compCaps = 99;
    p.intl.switches = -2;
    sanitizeIntl(p);
    expect(p.intl.tiedTo).toBe("FRA");
    expect(p.intl.compCaps).toBeLessThanOrEqual(p.intl.caps);
    expect(p.intl.switches).toBeUndefined();
  });

  it("a simulated user match still ends in a tie to the chosen nation", () => {
    const s = dual("sv-5");
    for (let i = 0; i < 5; i++) advanceTurn(s);
    for (const pm of [...s.pending]) simUserMatch(s, pm.fixtureId);
    expect(intlTeam(userPlayer(s))).toBe("FRA");
  });
});
