"use client";
/**
 * Application layer: bridges React UI ↔ framework-free engine ↔ IndexedDB.
 * The engine mutates the GameState in place; after each action we bump
 * `version` so subscribed components re-render.
 */
import { flushSync } from "react-dom";
import { create } from "zustand";
import { BALANCE } from "@/engine/balance";
import { dayNumber } from "@/engine/calendar";
import { ceremonyPending, completeCeremony, setCeremonyStep, startCeremony, type CeremonyKind } from "@/engine/awards/ceremony";
import { worldCeremonyPending } from "@/engine/awards/world";
import { hireAgent, releaseAgent } from "@/engine/career/agents";
import { acceptSponsorOffer, declineSponsorOffer } from "@/engine/career/sponsors";
import { resolveDecision } from "@/engine/career/events";
import { negotiate, requestRenewal, setTransferRequest, type NegotiationAction } from "@/engine/career/offers";
import { syncSagas } from "@/engine/career/saga/engine";
import type { MatchResult } from "@/engine/match/engine";
import { retireFromInternational } from "@/engine/national/national";
import { advanceTurn, completeUserMatch, findFixture, liveMatchRng, requestRest, retireUser, simUserMatch } from "@/engine/season/advance";
import { interruptReason, snapshotAttention, type InterruptReason } from "@/engine/season/interrupts";
import { prepareMatch, type PreparedMatch } from "@/engine/season/matchday";
import { chooseIntlNumber as chooseIntlNumberAction, chooseSquadNumber } from "@/engine/jersey/numbers";
import { performPreMatch, type PreMatchKind } from "@/engine/season/preview";
import type { GameState, TrainingPlan } from "@/engine/types";
import { createWorld, type NewCareerInput } from "@/engine/world/create";
import { withRng } from "@/engine/world/helpers";
import { Rng } from "@/engine/rng";
import { loadSave, saveGame, setKv, getKv } from "@/persistence/saves";

export type RewardKind = "training" | "recovery" | "morale";

interface LiveMatch {
  prepared: PreparedMatch;
  startedAt: number;
}

/** What the "Simulating…" overlay shows: the calendar day currently highlighted, which is never past the game's own date. */
export interface SimView {
  day: number;
  stepMs: number;
  ease: boolean;
  stopping: boolean;
  reason: InterruptReason | null;
}

interface GameStore {
  game: GameState | null;
  sim: SimView | null;
  stopSim: () => void;
  version: number;
  busy: string | null;
  error: string | null;
  lastSavedAt: string | null;
  recovered: boolean;
  live: LiveMatch | null;
  toast: { id: number; text: string; tone?: "good" | "bad" | "info" } | null;

  bump: () => void;
  notify: (text: string, tone?: "good" | "bad" | "info") => void;
  newCareer: (input: NewCareerInput) => Promise<GameState>;
  load: (id: string) => Promise<boolean>;
  loadActive: () => Promise<boolean>;
  close: () => void;
  save: (manual?: boolean) => Promise<void>;
  /** No argument: play on until something needs the player. A number: at most that many weeks (matches are quick-simmed). */
  advance: (weeks?: number) => Promise<void>;
  simMatch: (fixtureId: string) => Promise<MatchResult | null>;
  startLive: (fixtureId: string) => PreparedMatch | null;
  finishLive: () => Promise<void>;
  abandonLive: () => void;
  setTraining: (plan: TrainingPlan) => void;
  negotiate: (offerId: string, action: NegotiationAction) => string;
  decide: (decisionId: string, optionId: string) => void;
  /** Awards night: presentation only. Watching and skipping end in the same place. */
  ceremonyStart: (kind?: CeremonyKind) => void;
  ceremonyStep: (step: number, kind?: CeremonyKind) => void;
  ceremonyFinish: (how: "watched" | "skipped", kind?: CeremonyKind) => Promise<void>;
  transferRequest: (on: boolean) => void;
  requestRenewal: () => void;
  setWantsLoan: (on: boolean) => void;
  askRest: () => void;
  preMatch: (fixtureId: string, kind: PreMatchKind) => void;
  chooseNumber: (no: number) => void;
  chooseIntlNumber: (no: number) => void;
  hireAgent: (agentId: string) => void;
  releaseAgent: () => void;
  acceptSponsor: (offerId: string) => void;
  declineSponsor: (offerId: string) => void;
  retire: () => Promise<void>;
  retireInternational: () => void;
  grantReward: (kind: RewardKind) => boolean;
  setDifficulty: (d: GameState["settings"]["difficulty"]) => void;
  setAutoSave: (on: boolean) => void;
}

const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 16));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Safety cap for an open-ended run (a little over a season). */
const MAX_RUN_WEEKS = 60;
/** How long the overlay stays on the day a run stopped, so the reason can be read. */
const STOP_HOLD_MS = 200;
let stopRequested = false;

/** Milliseconds each calendar day stays highlighted: quick once a run is under way, slower for short ones. */
function stepMsFor(week: number, weeks: number | undefined): number {
  if (weeks === undefined) return week < 2 ? 220 : 130;
  return weeks <= 5 ? 150 : 50;
}

export const useGame = create<GameStore>((set, get) => ({
  game: null,
  sim: null,
  stopSim: () => {
    stopRequested = true;
    const sim = get().sim;
    if (sim) set({ sim: { ...sim, stopping: true } });
  },
  version: 0,
  busy: null,
  error: null,
  lastSavedAt: null,
  recovered: false,
  live: null,
  toast: null,

  bump: () => set((s) => ({ version: s.version + 1 })),
  notify: (text, tone = "info") => set({ toast: { id: Date.now(), text, tone } }),

  newCareer: async (input) => {
    set({ busy: "Building the football world…", error: null });
    await yieldFrame();
    try {
      const game = createWorld(input);
      const { beginTurn } = await import("@/engine/season/advance");
      beginTurn(game);
      set({ game, version: get().version + 1, live: null });
      await saveGame(game, { backup: true, label: "Career start" });
      await setKv("activeSaveId", game.id);
      set({ lastSavedAt: new Date().toISOString() });
      return game;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    } finally {
      set({ busy: null });
    }
  },

  load: async (id) => {
    set({ busy: "Loading career…", error: null });
    try {
      const { state, recovered } = await loadSave(id);
      set({ game: state, version: get().version + 1, recovered, live: null, lastSavedAt: state.updatedAt });
      await setKv("activeSaveId", id);
      if (recovered) get().notify("Your latest save was damaged — restored from a backup.", "bad");
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    } finally {
      set({ busy: null });
    }
  },

  loadActive: async () => {
    if (get().game) return true;
    const id = await getKv<string | null>("activeSaveId", null);
    if (!id) return false;
    return get().load(id);
  },

  close: () => set({ game: null, live: null }),

  save: async (manual = false) => {
    const g = get().game;
    if (!g) return;
    try {
      await saveGame(g, { backup: manual, label: manual ? "Manual save" : undefined });
      set({ lastSavedAt: new Date().toISOString() });
      if (manual) get().notify("Career saved.", "good");
    } catch (err) {
      get().notify(`Save failed: ${(err as Error).message}`, "bad");
    }
  },

  advance: async (weeks) => {
    const g = get().game;
    if (!g || get().busy) return;
    // A fast-forward is never run past an awards night waiting for the player: it would count as skipping it unseen.
    // (A single step is how the test handle and the Awards night buttons move on, and keeps its skip semantics.)
    if (weeks !== 1 && (worldCeremonyPending(g) || (ceremonyPending(g) && g.turn > BALANCE.calendar.endOfSeasonTurn))) {
      get().notify("The awards night is waiting. Watch it or skip it first.");
      return;
    }
    const untilEvent = weeks === undefined;
    const maxWeeks = untilEvent ? MAX_RUN_WEEKS : Math.max(1, weeks);
    // Open decisions fall back to their default as weeks pass: with some open, step one week rather than expire them unseen.
    const cautious = untilEvent && g.user.decisions.length > 0;
    const reduced = reducedMotion();
    stopRequested = false;
    set({ busy: "Simulating…", sim: { day: dayNumber(g.season, g.turn, g.turnDay), stepMs: 0, ease: false, stopping: false, reason: null } });
    await yieldFrame();
    try {
      let seasonRolled = false;
      let reason: InterruptReason | null = null;
      const before = snapshotAttention(g);
      const startSeason = g.season;
      const beforeSeasonEnd = g.turn <= BALANCE.calendar.endOfSeasonTurn;
      const baseOf = (week: number) => (reduced ? 0 : stepMsFor(week, weeks));

      // Plays one week and says how the run stands on its new date.
      const step = (week: number) => {
        const fromDay = dayNumber(g.season, g.turn, g.turnDay);
        const report = advanceTurn(g, { byDay: true });
        if (report.newSeason) seasonRolled = true;
        const toDay = dayNumber(g.season, g.turn, g.turnDay);
        const why = interruptReason(g, before, { newSeason: report.newSeason, stopOnMatch: untilEvent, stopForNews: untilEvent });
        // A multi-week sim from before the season's end always stops once the season has ended, so the summer
        // tournament and the transfer window are never skipped past.
        const seasonOver = !untilEvent && beforeSeasonEnd && g.season === startSeason && g.turn > BALANCE.calendar.endOfSeasonTurn;
        const last = why !== null || cautious || seasonOver || g.user.retired || week === maxWeeks - 1;
        return { fromDay, toDay, why, last };
      };

      // The first week is worked out before the strip moves: it is the heaviest (one frame of waiting beats a stutter).
      await yieldFrame();
      let cur = step(0);
      for (let week = 0; ; week++) {
        reason = cur.why;
        const base = baseOf(week);
        let next: ReturnType<typeof step> | null = null;
        for (let day = cur.fromDay + 1; day <= cur.toDay; day++) {
          const began = performance.now();
          const stopping = stopRequested;
          const ease = cur.last && !stopping && cur.toDay - day < 2 && base > 0;
          const ms = stopping ? Math.min(base, 40) : ease ? base * 1.6 : base;
          set({ sim: { day, stepMs: ms, ease, stopping, reason: null } });
          // The next week is worked out while this day's slide is under way, so the strip never waits between weeks.
          // (A frame first, so the slide has really started before the main thread is busy.)
          if (!cur.last && !next) {
            await yieldFrame();
            next = step(week + 1);
          }
          const left = ms - (performance.now() - began);
          if (left > 0) await sleep(left);
          else if (ms === 0 && day % 7 === 0) await yieldFrame();
        }
        if (cur.last || (!next && stopRequested)) break;
        // A week already worked out cannot be undone, so a Stop pressed meanwhile ends the run on it.
        cur = next ?? step(week + 1);
        if (stopRequested) cur.last = true;
      }
      // Landed: show why it stopped, and only then refresh the page behind (the repaint is the slow part, and
      // doing it any earlier would show the new date there before the strip has reached it).
      const landed = performance.now();
      const sim = get().sim;
      if (reason && !reduced && sim) {
        set({ sim: { ...sim, stepMs: 0, ease: false, reason } });
        await yieldFrame();
      }
      flushSync(() => set({ version: get().version + 1 }));
      if (reason && !reduced) await sleep(Math.max(0, STOP_HOLD_MS - (performance.now() - landed)));
      set({ sim: null });
      // Let the closed overlay paint before the save, which serialises the whole career and blocks the page for a moment.
      await sleep(50);
      if (g.settings.autoSave || seasonRolled) await saveGame(g, { backup: seasonRolled, label: seasonRolled ? `Season ${g.season} start` : undefined });
      set({ lastSavedAt: new Date().toISOString() });
    } catch (err) {
      console.error(err);
      set({ error: (err as Error).message });
    } finally {
      stopRequested = false;
      set({ busy: null, sim: null });
    }
  },

  simMatch: async (fixtureId) => {
    const g = get().game;
    if (!g) return null;
    set({ busy: "Simulating match…" });
    await yieldFrame();
    try {
      const res = simUserMatch(g, fixtureId);
      set({ version: get().version + 1 });
      return res;
    } finally {
      set({ busy: null });
    }
  },

  startLive: (fixtureId) => {
    const g = get().game;
    if (!g) return null;
    const found = findFixture(g, fixtureId);
    if (!found || found.fixture.result) return null;
    const rng = liveMatchRng(g, fixtureId);
    const prepared = prepareMatch(g, found.fixture, rng, { interactive: true, detail: true });
    set({ live: { prepared, startedAt: Date.now() }, version: get().version + 1 });
    return prepared;
  },

  finishLive: async () => {
    const g = get().game;
    const live = get().live;
    if (!g || !live) return;
    const eng = live.prepared.engine;
    const res = eng.finished ? eng.result() : eng.runToEnd();
    completeUserMatch(g, live.prepared.fixture.id, res);
    set({ version: get().version + 1 });
    if (g.settings.autoSave) await get().save();
  },

  abandonLive: () => set({ live: null }),

  setTraining: (plan) => {
    const g = get().game;
    if (!g) return;
    g.user.training = plan;
    get().bump();
  },

  negotiate: (offerId, action) => {
    const g = get().game;
    if (!g) return "";
    const res = withRng(g, (rng) => negotiate(g, offerId, action, rng));
    syncSagas(g);
    get().bump();
    get().notify(res.message, res.completed ? "good" : res.ok ? "info" : "bad");
    if (res.completed) void get().save();
    return res.message;
  },

  decide: (decisionId, optionId) => {
    const g = get().game;
    if (!g) return;
    const msg = resolveDecision(g, decisionId, optionId);
    syncSagas(g);
    get().bump();
    get().notify(msg);
  },

  ceremonyStart: (kind = "league") => {
    const g = get().game;
    if (!g || !startCeremony(g, kind)) return;
    get().bump();
    void get().save();
  },

  ceremonyStep: (step, kind = "league") => {
    const g = get().game;
    if (!g) return;
    setCeremonyStep(g, step, kind);
    get().bump();
    void get().save();
  },

  ceremonyFinish: async (how, kind = "league") => {
    const g = get().game;
    if (!g) return;
    completeCeremony(g, how, kind);
    get().bump();
    await get().save();
  },

  transferRequest: (on) => {
    const g = get().game;
    if (!g) return;
    get().notify(setTransferRequest(g, on));
    get().bump();
  },

  requestRenewal: () => {
    const g = get().game;
    if (!g) return;
    const res = withRng(g, (rng) => requestRenewal(g, rng));
    get().bump();
    get().notify(res.message, res.ok ? "good" : "bad");
    void get().save();
  },

  setWantsLoan: (on) => {
    const g = get().game;
    if (!g) return;
    g.user.wantsLoan = on;
    get().bump();
    get().notify(on ? "Your agent will look for loan opportunities in the next window." : "Loan search cancelled.");
  },

  hireAgent: (agentId) => {
    const g = get().game;
    if (!g) return;
    const res = hireAgent(g, agentId);
    get().notify(res.ok ? "You have a new agent." : res.reason ?? "Can't hire this agent.", res.ok ? "good" : "bad");
    get().bump();
  },

  releaseAgent: () => {
    const g = get().game;
    if (!g) return;
    releaseAgent(g);
    get().notify("You now represent yourself.");
    get().bump();
  },

  acceptSponsor: (offerId) => {
    const g = get().game;
    if (!g) return;
    const msg = acceptSponsorOffer(g, offerId);
    get().notify(msg, msg.startsWith("Signed") ? "good" : "bad");
    get().bump();
  },

  declineSponsor: (offerId) => {
    const g = get().game;
    if (!g) return;
    declineSponsorOffer(g, offerId);
    get().bump();
  },

  askRest: () => {
    const g = get().game;
    if (!g) return;
    get().notify(requestRest(g));
    get().bump();
  },

  preMatch: (fixtureId, kind) => {
    const g = get().game;
    if (!g) return;
    const res = performPreMatch(g, fixtureId, kind);
    get().notify(res.message, res.ok ? "good" : "bad");
    get().bump();
  },

  chooseNumber: (no) => {
    const g = get().game;
    if (!g) return;
    const r = chooseSquadNumber(g, no);
    get().notify(r.message, r.ok ? "good" : "bad");
    get().bump();
    if (r.ok) void get().save();
  },

  chooseIntlNumber: (no) => {
    const g = get().game;
    if (!g) return;
    const r = chooseIntlNumberAction(g, no);
    get().notify(r.message, r.ok ? "good" : "bad");
    get().bump();
  },

  retire: async () => {
    const g = get().game;
    if (!g) return;
    retireUser(g);
    get().bump();
    await saveGame(g, { backup: true, label: "Retirement" });
  },

  retireInternational: () => {
    const g = get().game;
    if (!g) return;
    get().notify(retireFromInternational(g));
    get().bump();
  },

  /**
   * Grant a small, temporary, centrally-balanced boost. Only called after an
   * ad provider reports a verified completed rewarded view.
   */
  grantReward: (kind) => {
    const g = get().game;
    if (!g) return false;
    const cfg = { training: BALANCE.rewards.trainingBoost, recovery: BALANCE.rewards.recoveryBoost, morale: BALANCE.rewards.moraleBoost }[kind];
    const last = g.user.rewardCooldowns[kind] ?? -999;
    if (g.turnIndex - last < cfg.cooldownTurns) return false;
    g.user.rewardCooldowns[kind] = g.turnIndex;
    g.user.boosts.push({ id: `${kind}-${g.turnIndex}`, kind, amount: cfg.amount, untilTurnIndex: g.turnIndex + cfg.durationTurns - 1, source: "reward" });
    get().bump();
    return true;
  },

  setDifficulty: (d) => {
    const g = get().game;
    if (!g) return;
    g.settings.difficulty = d;
    get().bump();
  },

  setAutoSave: (on) => {
    const g = get().game;
    if (!g) return;
    g.settings.autoSave = on;
    get().bump();
  },
}));

/** Subscribe to the game and re-render on every engine mutation. */
export function useGameState(): GameState | null {
  useGame((s) => s.version);
  return useGame((s) => s.game);
}

export { Rng };

// Debug/testing handle (dev and E2E builds only).
if (typeof window !== "undefined" && (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1")) {
  (window as unknown as { __pitchborn: typeof useGame }).__pitchborn = useGame;
}
