import type { GameState, SagaOutcome, SagaStage, TransferSaga } from "../../types";

export const SAGA_STAGES: readonly SagaStage[] = [
  "interest", "scouting", "agent-contact", "enquiry", "first-bid", "bid-rejected", "improved-bid", "player-unsettled", "manager-talk", "contract-talks",
  "transfer-request", "competing-bid", "deadline-pressure", "agreement", "medical", "completed", "failed",
];
const OUTCOMES: readonly SagaOutcome[] = ["completed", "rejected", "withdrawn", "negotiations-failed", "player-declined", "club-declined", "window-closed", "deadline-expired"];
const KEPT_FINISHED = 8;
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/**
 * Makes saga state safe to use whatever a save contains: unknown stages end the saga, dangling offer or decision
 * references are dropped, a saga whose deadline has passed is closed, and only one saga may be active.
 */
export function sanitizeSagas(state: GameState): void {
  const u = state.user;
  const raw: unknown[] = Array.isArray(u.sagas) ? u.sagas : [];
  const offerIds = new Set(u.offers.map((o) => o.id));
  const decisionIds = new Set((u.decisions ?? []).map((d) => d.id));
  const out: TransferSaga[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Partial<TransferSaga>;
    if (typeof s.id !== "string" || seen.has(s.id) || typeof s.clubId !== "string" || !state.clubs[s.clubId]) continue;
    seen.add(s.id);
    const stage: SagaStage = SAGA_STAGES.includes(s.stage as SagaStage) ? (s.stage as SagaStage) : "failed";
    const sagaFlags = s.flags && typeof s.flags === "object" ? s.flags : {};
    const saga: TransferSaga = {
      id: s.id,
      kind: s.kind === "free" ? "free" : "transfer",
      clubId: s.clubId,
      fromClubId: typeof s.fromClubId === "string" && state.clubs[s.fromClubId] ? s.fromClubId : null,
      rivals: strings(s.rivals).filter((c) => !!state.clubs[c]).slice(0, 3),
      stage,
      outcome: OUTCOMES.includes(s.outcome as SagaOutcome) ? s.outcome : undefined,
      window: s.window === "january" || s.window === "free" ? s.window : "summer",
      startSeason: num(s.startSeason, state.season),
      startTurn: num(s.startTurn, state.turn),
      startIndex: num(s.startIndex, state.turnIndex),
      deadlineIndex: num(s.deadlineIndex, state.turnIndex),
      lastStepIndex: num(s.lastStepIndex, state.turnIndex),
      endedIndex: typeof s.endedIndex === "number" ? s.endedIndex : undefined,
      fee: Math.max(0, num(s.fee, 0)),
      draft: s.draft && typeof s.draft === "object" && s.draft.terms ? s.draft : { terms: { wage: 0, years: 1, role: "backup", signingBonus: 0, goalBonus: 0 }, maxWage: 0 },
      offerIds: strings(s.offerIds).filter((id) => offerIds.has(id)),
      bids: Math.max(0, Math.round(num(s.bids, 0))),
      rejections: Math.max(0, Math.round(num(s.rejections, 0))),
      importance: num(s.importance, 0),
      reasons: strings(s.reasons).slice(0, 6),
      flags: sagaFlags,
      entries: (Array.isArray(s.entries) ? s.entries : [])
        .filter((e) => e && typeof e === "object" && typeof e.text === "string")
        .map((e) => ({ season: num(e.season, state.season), turn: num(e.turn, state.turn), stage: SAGA_STAGES.includes(e.stage) ? e.stage : stage, text: e.text }))
        .slice(-40),
      decisionId: typeof s.decisionId === "string" && decisionIds.has(s.decisionId) ? s.decisionId : undefined,
      snapshot: { reputation: num(s.snapshot?.reputation, 0), value: num(s.snapshot?.value, 0), requested: !!s.snapshot?.requested, yearsLeft: num(s.snapshot?.yearsLeft, 0) },
    };
    out.push(saga);
  }

  let activeSeen = false;
  for (const s of out) {
    const finished = s.stage === "completed" || s.stage === "failed";
    const stale = !finished && (s.deadlineIndex < state.turnIndex - 1 || s.startSeason > state.season);
    if (finished || (!stale && !activeSeen)) {
      if (!finished) activeSeen = true;
      if (finished) s.outcome ??= s.stage === "completed" ? "completed" : "withdrawn";
      continue;
    }
    // A stale or surplus active saga is closed, and its own offers with it.
    for (const o of u.offers) {
      if (o.sagaId === s.id && (o.status === "club-pending" || o.status === "terms" || o.status === "club-rejected")) o.status = "expired";
    }
    s.stage = "failed";
    s.outcome = stale ? "window-closed" : "withdrawn";
    s.endedIndex = state.turnIndex;
    s.decisionId = undefined;
  }
  // Decisions that point at a saga that no longer exists would otherwise sit there forever.
  u.decisions = (u.decisions ?? []).filter((d) => !d.sagaId || out.some((s) => s.id === d.sagaId && s.stage !== "completed" && s.stage !== "failed"));
  const active = out.filter((s) => s.stage !== "completed" && s.stage !== "failed");
  const finished = out.filter((s) => s.stage === "completed" || s.stage === "failed").slice(0, KEPT_FINISHED);
  u.sagas = [...active, ...finished];
}
