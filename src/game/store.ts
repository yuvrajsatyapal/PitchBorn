"use client";
/**
 * Application layer: bridges React UI ↔ framework-free engine ↔ IndexedDB.
 * The engine mutates the GameState in place; after each action we bump
 * `version` so subscribed components re-render.
 */
import { create } from "zustand";
import { BALANCE } from "@/engine/balance";
import { completeCeremony, setCeremonyStep, startCeremony } from "@/engine/awards/ceremony";
import { hireAgent, releaseAgent } from "@/engine/career/agents";
import { resolveDecision } from "@/engine/career/events";
import { negotiate, setTransferRequest, type NegotiationAction } from "@/engine/career/offers";
import { syncSagas } from "@/engine/career/saga/engine";
import type { MatchResult } from "@/engine/match/engine";
import { retireFromInternational } from "@/engine/national/national";
import { advanceTurn, completeUserMatch, findFixture, liveMatchRng, requestRest, retireUser, simUserMatch } from "@/engine/season/advance";
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

interface GameStore {
  game: GameState | null;
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
  advance: (weeks?: number) => Promise<void>;
  simMatch: (fixtureId: string) => Promise<MatchResult | null>;
  startLive: (fixtureId: string) => PreparedMatch | null;
  finishLive: () => Promise<void>;
  abandonLive: () => void;
  setTraining: (plan: TrainingPlan) => void;
  negotiate: (offerId: string, action: NegotiationAction) => string;
  decide: (decisionId: string, optionId: string) => void;
  /** Awards night: presentation only. Watching and skipping end in the same place. */
  ceremonyStart: () => void;
  ceremonyStep: (step: number) => void;
  ceremonyFinish: (how: "watched" | "skipped") => Promise<void>;
  transferRequest: (on: boolean) => void;
  setWantsLoan: (on: boolean) => void;
  askRest: () => void;
  preMatch: (fixtureId: string, kind: PreMatchKind) => void;
  chooseNumber: (no: number) => void;
  chooseIntlNumber: (no: number) => void;
  hireAgent: (agentId: string) => void;
  releaseAgent: () => void;
  retire: () => Promise<void>;
  retireInternational: () => void;
  grantReward: (kind: RewardKind) => boolean;
  setDifficulty: (d: GameState["settings"]["difficulty"]) => void;
  setAutoSave: (on: boolean) => void;
}

const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 16));

export const useGame = create<GameStore>((set, get) => ({
  game: null,
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

  advance: async (weeks = 1) => {
    const g = get().game;
    if (!g || get().busy) return;
    set({ busy: weeks > 1 ? "Simulating…" : "Playing the week…" });
    await yieldFrame();
    try {
      let seasonRolled = false;
      const startSeason = g.season;
      const beforeSeasonEnd = g.turn <= BALANCE.calendar.endOfSeasonTurn;
      for (let i = 0; i < weeks; i++) {
        // Multi-week sims run straight through: matches are quick-simmed and decisions use their fallback.
        if (i > 0 && g.user.retired) break;
        const report = advanceTurn(g);
        if (report.newSeason) seasonRolled = true;
        // A multi-week sim from before the season's end always stops once the season has ended, so the summer
        // tournament and the transfer window are never skipped past.
        if (weeks > 1 && beforeSeasonEnd && g.season === startSeason && g.turn > BALANCE.calendar.endOfSeasonTurn) break;
        if (weeks > 1 && i % 3 === 2) {
          set({ version: get().version + 1 });
          await yieldFrame();
        }
      }
      set({ version: get().version + 1 });
      if (g.settings.autoSave || seasonRolled) await saveGame(g, { backup: seasonRolled, label: seasonRolled ? `Season ${g.season} start` : undefined });
      set({ lastSavedAt: new Date().toISOString() });
    } catch (err) {
      console.error(err);
      set({ error: (err as Error).message });
    } finally {
      set({ busy: null });
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

  ceremonyStart: () => {
    const g = get().game;
    if (!g || !startCeremony(g)) return;
    get().bump();
    void get().save();
  },

  ceremonyStep: (step) => {
    const g = get().game;
    if (!g) return;
    setCeremonyStep(g, step);
    get().bump();
    void get().save();
  },

  ceremonyFinish: async (how) => {
    const g = get().game;
    if (!g) return;
    completeCeremony(g, how);
    get().bump();
    await get().save();
  },

  transferRequest: (on) => {
    const g = get().game;
    if (!g) return;
    get().notify(setTransferRequest(g, on));
    get().bump();
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
