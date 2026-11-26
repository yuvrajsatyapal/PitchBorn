/**
 * First-season tips: short, contextual pointers for new players. Not a tutorial flow: each tip belongs to one
 * screen, shows only while it is relevant, and once dismissed it never returns. All of it is off after the first
 * season, or when the player turns tips off in Settings.
 */
import { BALANCE } from "../balance";
import type { GameState } from "../types";

export type TipPage = "dashboard" | "match" | "training" | "club" | "transfers" | "profile";

export interface Tip {
  id: string;
  page: TipPage;
  title: string;
  body: string;
  /** Where the tip points, when there is somewhere to go. */
  link?: { href: string; label: string };
  when?: (s: GameState) => boolean;
}

const openOffers = (s: GameState) => s.user.offers.some((o) => o.status === "terms" || o.status === "club-pending");

/** Order matters: the first relevant tip for a screen is the one shown. */
export const TIPS: Tip[] = [
  {
    id: "dash-match", page: "dashboard", title: "It's match day",
    body: "Play the match live to make the key decisions yourself, or quick-sim it. Live matches let your choices change the result and your rating.",
    link: { href: "/play/match", label: "Go to Match Day" },
    when: (s) => s.pending.length > 0,
  },
  {
    id: "dash-decision", page: "dashboard", title: "Decisions shape your story",
    body: "Pop-ups ask how you handle life off the pitch. Each answer moves your relationships with the manager, teammates, fans or board. Ignore one for too long and the default is chosen for you.",
    when: (s) => s.user.decisions.length > 0,
  },
  {
    id: "dash-offer", page: "dashboard", title: "A club wants you",
    body: "Offers wait in Career & Contract. You can negotiate wage, years and role, but push too hard and the club may walk away.",
    link: { href: "/play/transfers", label: "Review offers" },
    when: openOffers,
  },
  {
    id: "dash-welcome", page: "dashboard", title: "Welcome to your career",
    body: "Continue moves the calendar on and stops whenever something needs you. Use » to skip several weeks. Your aim this season: earn minutes, impress the manager and grow your overall.",
  },
  {
    id: "dash-training", page: "dashboard", title: "Set your training",
    body: "Training decides which attributes grow each week. Pick a focus that suits your position and watch your fitness.",
    link: { href: "/play/training", label: "Open Training" },
    when: (s) => s.turnIndex >= 2,
  },
  {
    id: "dash-achievements", page: "dashboard", title: "Achievements",
    body: "Goals, milestones and trophies unlock achievements along the way. Your trophy cabinet shows what you've earned and what's next.",
    link: { href: "/play/achievements", label: "See achievements" },
    when: (s) => (s.user.achievements ?? []).some((a) => !a.backfilled),
  },
  {
    id: "match-moments", page: "match", title: "Key moments",
    body: "In a live match you choose what to do at key moments. Options that suit your strengths are likelier to come off; the risky ones pay off big when they do.",
    when: (s) => s.pending.length > 0,
  },
  {
    id: "training-intensity", page: "training", title: "Push, but not too hard",
    body: "Intense training grows attributes faster but drains fitness and raises the injury risk if you keep it up week after week. Light weeks help you recover before big games.",
  },
  {
    id: "club-relations", page: "club", title: "Relationships matter",
    body: "Manager trust earns you starts. Teammates, supporters and the board react to how you play and what you say. Each bar shows what moved it recently.",
  },
  {
    id: "transfers-loan", page: "transfers", title: "Not playing? Think loan",
    body: "Young players develop by playing. If minutes are scarce, ask your agent to find a loan; you'll come back better.",
    when: (s) => !s.players[s.user.playerId]?.loan,
  },
  {
    id: "profile-growth", page: "profile", title: "How you grow",
    body: "Attributes rise with training and match minutes until your peak years, then slowly fall. Potential is a ceiling, not a promise.",
  },
];

/** Tips run through the first full season (and its summer). */
export function inFirstSeason(state: GameState): boolean {
  return state.season === state.user.startSeason || (state.season === state.user.startSeason + 1 && state.turn < BALANCE.calendar.seasonStart);
}

export function tipsEnabled(state: GameState): boolean {
  return state.settings.tips !== false;
}

export function activeTip(state: GameState, page: TipPage): Tip | null {
  if (!tipsEnabled(state) || state.user.retired || !(inFirstSeason(state) || state.user.tipsReplaySeason === state.season)) return null;
  const seen = new Set(state.user.tipsSeen ?? []);
  for (const t of TIPS) {
    if (t.page !== page || seen.has(t.id)) continue;
    let ok = true;
    try {
      ok = t.when ? t.when(state) : true;
    } catch {
      ok = false;
    }
    if (ok) return t;
  }
  return null;
}

export function dismissTip(state: GameState, id: string): void {
  const seen = (state.user.tipsSeen ??= []);
  if (!seen.includes(id) && TIPS.some((t) => t.id === id)) seen.push(id);
}

/** Replay the tutorial: every tip shows again, this season, wherever it is relevant. */
export function replayTips(state: GameState): void {
  state.settings.tips = true;
  state.user.tipsSeen = [];
  state.user.tipsReplaySeason = state.season;
}

export function setTipsEnabled(state: GameState, on: boolean): void {
  state.settings.tips = on;
  // Turning tips back on shows them again from the start.
  if (on) state.user.tipsSeen = [];
}
