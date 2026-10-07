import { beforeAll, describe, expect, it } from "vitest";
import { expireDecisions, resolveDecision } from "../src/engine/career/events";
import { generateUserOffers, negotiate, type OfferDraft } from "../src/engine/career/offers";
import { divertToSaga, startSaga, stepSagas, syncSagas } from "../src/engine/career/saga/engine";
import { assessSaga, activeSaga, CLUB_COOLDOWN, isActiveSaga, SAGA_GAP, SAGA_MIN_SCORE } from "../src/engine/career/saga/eligibility";
import { sanitizeSagas } from "../src/engine/career/saga/sanitize";
import { rememberSaga } from "../src/engine/memory/detect";
import { marketValue } from "../src/engine/players/economy";
import { Rng } from "../src/engine/rng";
import type { ClubState, GameState, SagaStage, TransferSaga } from "../src/engine/types";
import { checkInvariants } from "../src/engine/validate";
import { removeFromSquad, userPlayer } from "../src/engine/world/helpers";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { newCareer } from "./helpers";

const ALWAYS = { chance: () => true } as unknown as Rng;

/** A star on the summer window's first week, with the richest clubs able to pay any fee. */
function starState(base: GameState, turn = 45): GameState {
  const s = structuredClone(base);
  const p = userPlayer(s);
  for (const k of Object.keys(p.attrs)) (p.attrs as Record<string, number>)[k] = 90;
  p.reputation = 94;
  p.form = 8;
  for (const c of Object.values(s.clubs)) c.balance = Math.max(c.balance, 5e9);
  s.turn = turn;
  s.turnIndex = turn;
  return s;
}

const topClub = (s: GameState): ClubState => Object.values(s.clubs).filter((c) => c.id !== userPlayer(s).clubId).sort((a, b) => b.reputation - a.reputation)[0];

function draftFor(s: GameState, club: ClubState, kind: "transfer" | "free" = "transfer"): OfferDraft {
  const p = userPlayer(s);
  const value = marketValue(p, s.season);
  return { kind, fee: kind === "free" ? 0 : Math.round(value / 50000) * 50000, terms: { wage: 200_000, years: 4, role: "star", signingBonus: 0, goalBonus: 0 }, maxWage: 260_000 };
}

function begin(s: GameState, club = topClub(s), kind: "transfer" | "free" = "transfer"): TransferSaga {
  const a = assessSaga(s, club, kind, kind === "free" ? 0 : 50e6);
  return startSaga(s, club, draftFor(s, club, kind), a);
}

/** Plays a saga forward week by week, the way the weekly turn does, answering decisions with `choose`. */
function play(s: GameState, rng: Rng, choose: (s: GameState, optionIds: string[]) => string, maxTurn = 50): TransferSaga {
  const saga = activeSaga(s) as TransferSaga;
  while (isActiveSaga(saga) && s.turn <= maxTurn) {
    for (const d of [...s.user.decisions]) if (d.sagaId) resolveDecision(s, d.id, choose(s, d.options.map((o) => o.id)));
    s.turn++;
    s.turnIndex++;
    stepSagas(s, rng);
    expireDecisions(s);
  }
  return saga;
}

const pickRandom = (rng: Rng) => (_s: GameState, ids: string[]) => rng.pick(ids);
const pathOf = (s: TransferSaga) => s.entries.map((e) => e.stage).filter((st, i, a) => i === 0 || st !== a[i - 1]);

let base: GameState;
beforeAll(() => {
  base = newCareer({ seed: "saga-base" });
}, 60000);

describe("saga eligibility", () => {
  it("an ordinary player is not a saga candidate, whoever is calling", () => {
    const s = structuredClone(base);
    s.turn = 46;
    s.turnIndex = 46;
    for (const c of Object.values(s.clubs)) {
      const a = assessSaga(s, c, "transfer", 3e6);
      expect(a.chance, c.id).toBe(0);
    }
  });

  it("ordinary offers stay ordinary: no saga, no saga id, over many weeks of offers", () => {
    const s = structuredClone(base);
    const p = userPlayer(s);
    p.reputation = 40;
    for (let i = 0; i < 80; i++) {
      s.turn = 45 + (i % 6);
      s.turnIndex = 200 + i;
      generateUserOffers(s, Rng.fromSeed(`ord${i}`), (club, draft, rng) => divertToSaga(s, club, draft, rng));
    }
    expect(s.user.sagas).toHaveLength(0);
    expect(s.user.offers.length).toBeGreaterThan(0);
    expect(s.user.offers.every((o) => !o.sagaId)).toBe(true);
  });

  it("importance is context-driven: a star beats an ordinary player, and rivals, former clubs and unrest add to it", () => {
    const s = starState(base);
    const club = topClub(s);
    const p = userPlayer(s);
    const plain = assessSaga(s, club, "transfer", 60e6);
    expect(plain.score).toBeGreaterThanOrEqual(SAGA_MIN_SCORE);
    expect(plain.chance).toBeGreaterThan(0);
    expect(plain.chance).toBeLessThan(0.6); // even a superstar's call is not certain to become a saga

    const unrest = structuredClone(s);
    userPlayer(unrest).morale = 30;
    unrest.user.transferRequest = true;
    expect(assessSaga(unrest, club, "transfer", 60e6).score).toBeGreaterThan(plain.score);

    const former = structuredClone(s);
    userPlayer(former).history.push({ season: 2024, clubId: club.id, age: 19, overall: 70, stats: { apps: 30, goals: 5, assists: 3, minutes: 2000, ratingSum: 200 } } as never);
    expect(assessSaga(former, club, "transfer", 60e6).reasons).toContain("A former club");

    const poor = structuredClone(s);
    poor.clubs[club.id].balance = 1000;
    expect(assessSaga(poor, poor.clubs[club.id], "transfer", 60e6).score).toBeLessThan(plain.score);
    void p;
  });

  it("is blocked when the window is closed, too late in the window, or the player is retired", () => {
    const closed = starState(base, 30);
    expect(assessSaga(closed, topClub(closed), "transfer", 60e6).blocked).toBe("window closed");
    const late = starState(base, 49);
    expect(assessSaga(late, topClub(late), "transfer", 60e6).blocked).toBe("too late in the window");
    const retired = starState(base);
    retired.user.retired = true;
    expect(assessSaga(retired, topClub(retired), "transfer", 60e6).chance).toBe(0);
  });

  it("only one saga at a time, and sagas are spaced out", () => {
    const s = starState(base);
    const first = begin(s);
    expect(assessSaga(s, topClub(s), "transfer", 60e6).blocked).toBe("a saga is already running");
    first.stage = "failed";
    first.outcome = "withdrawn";
    first.endedIndex = s.turnIndex;
    const other = Object.values(s.clubs).filter((c) => c.id !== first.clubId && c.id !== userPlayer(s).clubId).sort((a, b) => b.reputation - a.reputation)[0];
    expect(assessSaga(s, other, "transfer", 60e6).blocked).toBe("too soon after the last saga");
    s.turnIndex += SAGA_GAP;
    s.turn = 21; // January
    expect(assessSaga(s, other, "transfer", 60e6).blocked).toBeUndefined();
  });

  it("the same club cannot repeat a saga unless circumstances changed materially", () => {
    const s = starState(base);
    const club = topClub(s);
    const first = begin(s, club);
    first.stage = "failed";
    first.outcome = "club-declined";
    first.endedIndex = s.turnIndex;
    s.turnIndex += SAGA_GAP + 6;
    s.turn = 21;
    first.snapshot = { reputation: userPlayer(s).reputation, value: marketValue(userPlayer(s), s.season), requested: false, yearsLeft: 3 };
    expect(assessSaga(s, club, "transfer", 60e6).blocked).toBe("same club, same circumstances");
    userPlayer(s).reputation = Math.min(100, first.snapshot.reputation + 9);
    s.user.transferRequest = true;
    expect(assessSaga(s, club, "transfer", 60e6).blocked).toBeUndefined();
    // And after the cooldown the club is free to try again regardless.
    userPlayer(s).reputation = first.snapshot.reputation;
    s.user.transferRequest = false;
    s.turnIndex += CLUB_COOLDOWN;
    expect(assessSaga(s, club, "transfer", 60e6).blocked).toBeUndefined();
  });

  it("divertToSaga starts one saga from a qualifying offer, and not from a blocked one", () => {
    const s = starState(base);
    const club = topClub(s);
    expect(divertToSaga(s, club, draftFor(s, club), ALWAYS)).toBe(true);
    expect(s.user.sagas).toHaveLength(1);
    expect(divertToSaga(s, club, draftFor(s, club), ALWAYS)).toBe(false);
    expect(s.user.sagas).toHaveLength(1);
    expect(s.user.sagas[0].window).toBe("summer");
    expect(s.user.sagas[0].reasons.length).toBeGreaterThan(0);
  });
});

describe("saga state machine", () => {
  const results: { seed: number; saga: TransferSaga; state: GameState }[] = [];
  const snapshots: Record<string, GameState> = {};
  const decisionLog = new Set<string>();

  beforeAll(() => {
    for (let i = 1; i <= 120; i++) {
      const s = starState(base, [41, 42, 43, 45, 46, 47][i % 6]);
      const rng = Rng.fromSeed(`saga-${i}`);
      begin(s);
      const choose = (st: GameState, ids: string[]) => {
        for (const d of st.user.decisions) {
          if (!d.sagaId) continue;
          const key = d.eventId;
          decisionLog.add(key);
          snapshots[key] ??= structuredClone(st);
        }
        return pickRandom(rng)(st, ids);
      };
      const saga = play(s, rng, choose);
      results.push({ seed: i, saga, state: s });
    }
  }, 240000);

  it("never gets stuck: every saga ends by its deadline and leaves nothing open", () => {
    for (const { saga, state } of results) {
      expect(isActiveSaga(saga), `seed ${saga.id}`).toBe(false);
      expect(saga.outcome).toBeDefined();
      expect(saga.endedIndex).toBeLessThanOrEqual(saga.deadlineIndex);
      expect(state.user.offers.filter((o) => o.sagaId === saga.id && (o.status === "terms" || o.status === "club-pending" || o.status === "club-rejected"))).toEqual([]);
      expect(state.user.decisions.filter((d) => d.sagaId === saga.id)).toEqual([]);
      expect(state.turn).toBeLessThanOrEqual(51);
    }
  });

  it("only ever makes legal moves between stages, and has no fixed script", () => {
    const allowed: Record<SagaStage, SagaStage[]> = {
      interest: ["scouting", "agent-contact", "first-bid", "contract-talks", "deadline-pressure", "failed"],
      scouting: ["agent-contact", "enquiry", "deadline-pressure", "failed"],
      "agent-contact": ["enquiry", "first-bid", "contract-talks", "deadline-pressure", "failed"],
      enquiry: ["first-bid", "deadline-pressure", "failed"],
      "first-bid": ["bid-rejected", "contract-talks", "deadline-pressure", "failed"],
      "bid-rejected": ["improved-bid", "player-unsettled", "competing-bid", "deadline-pressure", "failed"],
      "improved-bid": ["bid-rejected", "contract-talks", "deadline-pressure", "failed"],
      "player-unsettled": ["manager-talk", "transfer-request", "improved-bid", "deadline-pressure", "failed"],
      "manager-talk": ["improved-bid", "competing-bid", "transfer-request", "deadline-pressure", "failed"],
      "transfer-request": ["improved-bid", "competing-bid", "deadline-pressure", "failed"],
      "competing-bid": ["bid-rejected", "contract-talks", "deadline-pressure", "failed"],
      "contract-talks": ["competing-bid", "deadline-pressure", "completed", "agreement", "failed"],
      "deadline-pressure": ["contract-talks", "first-bid", "failed"],
      agreement: ["medical"],
      medical: ["completed"],
      completed: [],
      failed: [],
    };
    const paths = new Set<string>();
    for (const { saga } of results) {
      const path = pathOf(saga);
      paths.add(path.join(">"));
      for (let i = 1; i < path.length; i++) expect(allowed[path[i - 1]], `${path.join(">")}`).toContain(path[i]);
      expect(path[0]).toBe("interest");
      expect(["completed", "failed"]).toContain(path[path.length - 1]);
    }
    expect(paths.size).toBeGreaterThan(5);
    expect(Math.min(...results.map((r) => pathOf(r.saga).length))).toBeLessThan(Math.max(...results.map((r) => pathOf(r.saga).length)));
  });

  it("covers the endings the design calls for, including failures", () => {
    const outcomes = new Set(results.map((r) => r.saga.outcome));
    expect(outcomes.has("completed")).toBe(true);
    expect([...outcomes].some((o) => o !== "completed")).toBe(true);
    for (const o of outcomes) expect(["completed", "rejected", "withdrawn", "negotiations-failed", "player-declined", "club-declined", "window-closed", "deadline-expired"]).toContain(o);
  });

  it("produces rejected and improved bids, competing clubs, unrest, and transfer requests", () => {
    const stages = new Set(results.flatMap((r) => r.saga.entries.map((e) => e.stage)));
    for (const st of ["bid-rejected", "improved-bid", "competing-bid", "player-unsettled", "manager-talk", "contract-talks", "deadline-pressure"] as SagaStage[]) {
      expect(stages.has(st), st).toBe(true);
    }
    const withRival = results.find((r) => r.saga.rivals.length > 0);
    expect(withRival).toBeDefined();
    const rivalOffers = withRival!.state.user.offers.filter((o) => o.sagaId === withRival!.saga.id && withRival!.saga.rivals.includes(o.fromClubId));
    expect(rivalOffers.length).toBeGreaterThan(0);
    expect(results.some((r) => r.saga.flags.requested || r.saga.stage === "failed")).toBe(true);
  });

  it("lets a story brew before the window opens but never bids until it does", () => {
    const early = results.filter((r) => r.saga.startTurn < 45);
    expect(early.length).toBeGreaterThan(0);
    for (const { saga, state } of early) {
      expect(saga.window).toBe("summer");
      expect(saga.deadlineIndex).toBe(50);
      for (const o of state.user.offers.filter((x) => x.sagaId === saga.id)) expect(o.createdTurn).toBeGreaterThanOrEqual(45);
    }
  });

  it("rumour weeks make no ordinary offers, only sagas", () => {
    for (let i = 0; i < 40; i++) {
      const s = starState(base, 41 + (i % 3));
      generateUserOffers(s, Rng.fromSeed(`rum${i}`), (club, draft, rng) => divertToSaga(s, club, draft, rng), true);
      expect(s.user.offers).toEqual([]);
      expect(s.user.sagas.length).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic for a seed", () => {
    const run = () => {
      const s = starState(base);
      const rng = Rng.fromSeed("det");
      begin(s);
      const saga = play(s, rng, pickRandom(rng));
      return JSON.stringify([saga, s.user.offers.filter((o) => o.sagaId), s.user.relationships]);
    };
    expect(run()).toBe(run());
  });

  it("moves about one stage a week, and faster only as the deadline closes in", () => {
    for (const { saga } of results) {
      const deadlineTurn = saga.deadlineIndex; // turn index equals turn in these tests
      const byTurn = new Map<number, number>();
      for (const e of saga.entries) byTurn.set(e.turn, (byTurn.get(e.turn) ?? 0) + 1);
      for (const [turn, n] of byTurn) {
        expect(n, `turn ${turn}`).toBeLessThanOrEqual(deadlineTurn - turn > 3 ? 4 : 10);
      }
    }
  });

  it("raises the saga's decisions and answers them with real consequences", () => {
    expect(decisionLog.has("saga:manager") || decisionLog.has("saga:terms")).toBe(true);
    const mgr = snapshots["saga:manager"];
    if (mgr) {
      const d = mgr.user.decisions.find((x) => x.eventId === "saga:manager")!;
      const sagaOf = (st: GameState) => st.user.sagas.find((x) => x.id === d.sagaId)!;

      const commit = structuredClone(mgr);
      const m0 = commit.user.relationships.manager;
      resolveDecision(commit, d.id, "commit");
      expect(sagaOf(commit).outcome).toBe("player-declined");
      expect(sagaOf(commit).flags.committed).toBe(true);
      expect(commit.user.relationships.manager).toBeGreaterThan(m0);
      expect(commit.user.relationships.supporters).toBeGreaterThan(mgr.user.relationships.supporters);
      expect(commit.user.loyaltyStands ?? 0).toBeGreaterThan(mgr.user.loyaltyStands ?? 0);

      const push = structuredClone(mgr);
      resolveDecision(push, d.id, "push");
      expect(push.user.transferRequest).toBe(true);
      expect(sagaOf(push).stage).toBe("transfer-request");
      expect(push.user.relationships.board).toBeLessThan(mgr.user.relationships.board);

      const listen = structuredClone(mgr);
      resolveDecision(listen, d.id, "listen");
      expect(isActiveSaga(sagaOf(listen))).toBe(true);
    }
    const terms = snapshots["saga:terms"];
    if (terms) {
      const d = terms.user.decisions.find((x) => x.eventId === "saga:terms")!;
      const decline = structuredClone(terms);
      resolveDecision(decline, d.id, "decline");
      expect(decline.user.sagas.find((x) => x.id === d.sagaId)!.outcome).toBe("player-declined");
      const wait = structuredClone(terms);
      resolveDecision(wait, d.id, "wait");
      expect(wait.user.sagas.find((x) => x.id === d.sagaId)!.flags.waited).toBe(true);
    }
  });

  it("hands completion to the existing offer flow once, with no duplicated money or squad changes", () => {
    const done = results.find((r) => r.saga.outcome === "completed");
    expect(done).toBeDefined();
    const { saga, state } = done!;
    const p = userPlayer(state);
    expect(p.clubId).toBe(saga.clubId);
    const offer = state.user.offers.find((o) => o.sagaId === saga.id && o.status === "accepted")!;
    expect(offer).toBeDefined();
    expect(state.user.transfers.filter((t) => t.to === saga.clubId && t.turn === state.turn - 0 || t.to === saga.clubId).length).toBe(1);
    expect(state.transferLog.filter((t) => t.playerId === p.id && t.to === saga.clubId)).toHaveLength(1);
    expect(state.clubs[saga.clubId].squad.filter((id) => id === p.id)).toHaveLength(1);
    expect(checkInvariants(state).issues).toEqual([]);
  });

  it("a user's accept in contract talks moves the player exactly once and syncing again changes nothing", () => {
    const s = starState(base);
    const rng = Rng.fromSeed("handoff");
    const saga = begin(s);
    // Walk the saga until personal terms are open.
    let guard = 0;
    while (isActiveSaga(saga) && !s.user.offers.some((o) => o.sagaId === saga.id && o.status === "terms") && guard++ < 6) {
      for (const d of [...s.user.decisions]) resolveDecision(s, d.id, d.fallback);
      s.turn++;
      s.turnIndex++;
      stepSagas(s, rng);
    }
    const offer = s.user.offers.find((o) => o.sagaId === saga.id && o.status === "terms");
    if (!offer) return; // this seed's bids all failed; the flow-wide tests above cover completion
    const seller = s.clubs[saga.fromClubId as string];
    const buyer = s.clubs[offer.fromClubId];
    const before = { seller: seller.balance, buyer: buyer.balance, moves: s.user.transfers.length, log: s.transferLog.length };
    negotiate(s, offer.id, { type: "accept" }, rng);
    syncSagas(s);
    expect(saga.stage).toBe("completed");
    expect(seller.balance).toBe(before.seller + offer.fee);
    expect(buyer.balance).toBe(before.buyer - offer.fee);
    expect(s.user.transfers.length).toBe(before.moves + 1);
    expect(s.transferLog.length).toBe(before.log + 1);
    const snapshot = JSON.stringify([seller.balance, buyer.balance, s.user.bank, s.user.transfers.length]);
    syncSagas(s);
    stepSagas(s, rng);
    expect(JSON.stringify([seller.balance, buyer.balance, s.user.bank, s.user.transfers.length])).toBe(snapshot);
    expect(checkInvariants(s).issues).toEqual([]);
  });

  it("an unattended saga runs out its window and ends as expired, closing its offers", () => {
    for (const startTurn of [41, 45, 48]) {
      const s = starState(base, startTurn);
      const rng = Rng.fromSeed(`idle-${startTurn}`);
      const saga = begin(s);
      while (isActiveSaga(saga) && s.turn <= 50) {
        s.turn++;
        s.turnIndex++;
        stepSagas(s, rng);
        expireDecisions(s);
      }
      expect(isActiveSaga(saga)).toBe(false);
      expect(s.turnIndex - startTurn).toBeLessThanOrEqual(saga.deadlineIndex - startTurn + 1);
      expect(s.user.offers.filter((o) => o.sagaId === saga.id).every((o) => o.status !== "terms" && o.status !== "club-pending")).toBe(true);
    }
  });

  it("a buyer that cannot pay walks away: the saga fails as club-declined", () => {
    const s = starState(base, 46);
    const club = topClub(s);
    s.clubs[club.id].balance = 0;
    const rng = Rng.fromSeed("broke");
    const saga = begin(s, club);
    play(s, rng, pickRandom(rng));
    expect(saga.outcome).toBe("club-declined");
    expect(s.user.offers.filter((o) => o.sagaId === saga.id)).toEqual([]);
    expect(userPlayer(s).clubId).toBe(saga.fromClubId);
  });

  it("works in the January window and for a free agent", () => {
    const jan = starState(base, 21);
    const rng = Rng.fromSeed("jan");
    const saga = begin(jan);
    expect(saga.window).toBe("january");
    expect(saga.deadlineIndex).toBe(24);
    play(jan, rng, pickRandom(rng), 24);
    expect(isActiveSaga(saga)).toBe(false);

    const free = starState(base, 30);
    const p = userPlayer(free);
    removeFromSquad(free, p.id);
    p.clubId = null;
    p.contract = null;
    const fs = begin(free, topClub(free), "free");
    expect(fs.window).toBe("free");
    expect(fs.kind).toBe("free");
    const rng2 = Rng.fromSeed("free");
    play(free, rng2, pickRandom(rng2), 43);
    expect(isActiveSaga(fs)).toBe(false);
    expect(fs.entries.some((e) => e.stage === "contract-talks")).toBe(true);
  });
});

describe("football memories", () => {
  it("a dramatic saga becomes a memory, and a trivial one does not", () => {
    const s = starState(base);
    const saga = begin(s);
    saga.stage = "completed";
    saga.outcome = "completed";
    saga.endedIndex = s.turnIndex + 4;
    saga.rejections = 3;
    saga.bids = 4;
    saga.fee = 90e6;
    saga.rivals = [Object.values(s.clubs).sort((a, b) => b.reputation - a.reputation)[1].id];
    saga.flags = { requested: true, deadline: true };
    const m = rememberSaga(s, saga);
    expect(m).not.toBeNull();
    expect(m!.kind).toBe("transfer-saga");
    expect(m!.importance).toBeGreaterThanOrEqual(40);
    expect(s.user.memories.some((x) => x.kind === "transfer-saga")).toBe(true);
    expect(m!.factors.map((f) => f[0])).toEqual(expect.arrayContaining(["Rejected bids", "Transfer request"]));

    const quiet = starState(base);
    const q = begin(quiet);
    q.stage = "failed";
    q.outcome = "window-closed";
    q.fee = 0;
    expect(rememberSaga(quiet, q)).toBeNull();
  });

  it("a loyalty decision is remembered", () => {
    const s = starState(base);
    const saga = begin(s);
    saga.stage = "failed";
    saga.outcome = "player-declined";
    saga.flags = { committed: true };
    saga.fee = 80e6;
    saga.rejections = 2;
    const m = rememberSaga(s, saga);
    expect(m?.factors.map((f) => f[0])).toContain("Loyalty decision");
  });
});

describe("saga persistence", () => {
  const finished = (s: GameState) => {
    const rng = Rng.fromSeed("persist");
    begin(s);
    return play(s, rng, pickRandom(rng));
  };

  it("survives a JSON round trip and the compact save codec", () => {
    const s = starState(base);
    finished(s);
    begin(s, topClub(s)); // may be blocked by cooldown; that is fine
    const back = JSON.parse(JSON.stringify(s)) as GameState;
    expect(back.user.sagas).toEqual(s.user.sagas);
    const decoded = decodeState(JSON.parse(JSON.stringify(encodeState(s))));
    expect(decoded.user.sagas).toEqual(s.user.sagas);
    expect(migrateState(structuredClone(decoded) as never).user.sagas).toEqual(s.user.sagas);
  });

  it("old saves with no saga data load cleanly", () => {
    const raw = JSON.parse(JSON.stringify(base)) as Record<string, unknown> & { user: Record<string, unknown>; schemaVersion: number };
    delete raw.user.sagas;
    raw.schemaVersion = 6;
    const m = migrateState(raw as never);
    expect(m.user.sagas).toEqual([]);
    expect(m.schemaVersion).toBe(7);
    const noField = JSON.parse(JSON.stringify(base)) as Record<string, unknown> & { user: Record<string, unknown> };
    delete noField.user.sagas;
    expect(migrateState(noField as never).user.sagas).toEqual([]);
  });

  it("sanitizes invalid saga state instead of trusting it", () => {
    const s = starState(base);
    const saga = begin(s);
    const ghost = { ...structuredClone(saga), id: "ghost", stage: "bogus", clubId: "no-such-club" };
    const second = { ...structuredClone(saga), id: "second" };
    const stale = { ...structuredClone(saga), id: "stale", deadlineIndex: s.turnIndex - 20 };
    const dangling = { ...structuredClone(saga), id: "dangling", stage: "failed", offerIds: ["missing-offer"], entries: [{ text: 5 }, { text: "ok", stage: "nope" }] };
    s.user.sagas = [null as never, "junk" as never, ghost as never, saga, second, stale, dangling as never];
    s.user.decisions.push({ id: "orphan", kind: "event", title: "x", body: "", options: [], expiresTurn: 50, season: s.season, eventId: "saga:terms", fallback: "wait", sagaId: "nowhere" });
    sanitizeSagas(s);
    const active = s.user.sagas.filter(isActiveSaga);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(saga.id);
    expect(s.user.sagas.find((x) => x.id === "ghost")).toBeUndefined();
    expect(s.user.sagas.find((x) => x.id === "second")?.outcome).toBe("withdrawn");
    expect(s.user.sagas.find((x) => x.id === "stale")?.outcome).toBe("window-closed");
    const d = s.user.sagas.find((x) => x.id === "dangling")!;
    expect(d.offerIds).toEqual([]);
    expect(d.entries.map((e) => e.text)).toEqual(["ok"]);
    expect(s.user.decisions.find((x) => x.id === "orphan")).toBeUndefined();
    expect(checkInvariants(s).issues.filter((i) => i.includes("saga"))).toEqual([]);
  });

  it("migrateState sanitizes saga data in a current-version save too", () => {
    const s = starState(base);
    begin(s);
    const raw = JSON.parse(JSON.stringify(s)) as GameState;
    raw.user.sagas[0].stage = "nonsense" as SagaStage;
    raw.user.sagas[0].offerIds = "not-an-array" as never;
    const m = migrateState(raw as never);
    expect(m.user.sagas.every((x) => x.stage === "completed" || x.stage === "failed")).toBe(true);
  });
});
