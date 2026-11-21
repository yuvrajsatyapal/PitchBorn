/**
 * Press conferences: after notable matches (and before the biggest ones) reporters ask the player two or three
 * questions. Each answer has a tone and moves morale, reputation and the relationships with the manager, teammates,
 * supporters or board. Nothing is forced: an unanswered conference simply lapses.
 *
 * Questions are drawn from a seeded stream of their own (seed + fixture), so press never shifts the world's RNG.
 */
import { BALANCE } from "../balance";
import { clubName, staticClub } from "../data/world";
import { poolFor } from "../data/names";
import { rivalryLevel } from "../memory/rivalry";
import type { MatchResult, PlayerLine } from "../match/engine";
import { ageOf } from "../players/generate";
import { clamp, Rng } from "../rng";
import type { Competition, Fixture, GameState, PressAnswer, PressConference, PressEffects, PressQuestion, PressTone, Relationships } from "../types";
import { addNews, nextId, userPlayer } from "../world/helpers";
import { adjustRel } from "./relationships";

const OUTLETS = ["The Touchline", "Matchday Mirror", "The Final Whistle", "Pitchside Daily", "The Terrace Times", "Ninety Minutes", "The Back Post", "Full-Time Report"];
export const PRESS_LOG_CAP = 30;

export const TONE_LABEL: Record<PressTone, string> = { humble: "Humble", confident: "Confident", fiery: "Fiery", deflect: "Diplomatic" };

/** Who likes what, in plain words, so the choice is informed but not a spreadsheet. */
function hintFor(e: PressEffects): string {
  const parts: string[] = [];
  const name: Record<keyof Relationships, string> = { manager: "manager", teammates: "dressing room", supporters: "fans", board: "board", agent: "agent" };
  for (const k of ["manager", "teammates", "supporters", "board"] as const) {
    const v = e[k] ?? 0;
    if (Math.abs(v) >= 1) parts.push(`${v > 0 ? "+" : "−"} ${name[k]}`);
  }
  if ((e.morale ?? 0) >= 2) parts.push("+ confidence");
  if ((e.morale ?? 0) <= -2) parts.push("− confidence");
  if ((e.reputation ?? 0) >= 0.5) parts.push("+ profile");
  return parts.join(" · ") || "Plays it safe";
}

function answer(id: string, tone: PressTone, label: string, effects: PressEffects, reaction: string): PressAnswer {
  return { id, tone, label, effects, reaction, hint: hintFor(effects) };
}

export interface PressContext {
  kind: "pre" | "post";
  comp: Competition;
  fixture: Fixture;
  opponentId: string;
  myTeam: string;
  /** Post-match only. */
  line?: PlayerLine;
  res?: MatchResult;
  mine?: number;
  theirs?: number;
}

function reporter(rng: Rng): { reporter: string; outlet: string } {
  const pool = poolFor(rng.pick(["english", "english", "spanish", "italian", "german", "french"]));
  return { reporter: `${rng.pick(pool.first)} ${rng.pick(pool.last)}`, outlet: rng.pick(OUTLETS) };
}

type Builder = (s: GameState, c: PressContext, rng: Rng) => Omit<PressQuestion, "reporter" | "outlet"> | null;

const opp = (c: PressContext) => clubName(c.opponentId);
const manager = (s: GameState) => {
  const p = userPlayer(s);
  return p.clubId ? s.clubs[p.clubId]?.manager.name ?? "the manager" : "the manager";
};

const RESULT: Builder = (s, c, rng) => {
  if (c.kind !== "post" || c.mine === undefined || c.theirs === undefined) return null;
  const won = c.mine > c.theirs;
  const lost = c.mine < c.theirs;
  const score = `${c.mine}-${c.theirs}`;
  if (won) {
    return {
      id: "result", topic: "result",
      text: rng.pick([`A ${score} win over ${opp(c)}. What made the difference today?`, `${score} against ${opp(c)}. How good does that feel?`, `Three points against ${opp(c)}. Was that the plan from the start?`]),
      answers: [
        answer("team", "humble", "It was a team performance. Everyone ran for each other.", { teammates: 2.5, manager: 1, morale: 1 }, "The dressing room liked hearing that."),
        answer("us", "confident", "We showed today we can beat anyone in this league.", { supporters: 2.5, morale: 2, reputation: 0.4, board: 0.5 }, "The fans lapped it up."),
        answer("easy", "fiery", `Honestly? ${opp(c)} made it easy for us.`, { supporters: 3, manager: -1.5, reputation: 0.6, morale: 1 }, "A headline-grabber. The manager would have preferred something quieter."),
      ],
    };
  }
  if (lost) {
    return {
      id: "result", topic: "result",
      text: rng.pick([`A ${score} defeat to ${opp(c)}. What went wrong?`, `${score}. Where does the team go from here?`, `Supporters are frustrated after losing to ${opp(c)}. Your message to them?`]),
      answers: [
        answer("own", "humble", "We weren't good enough. I take my share of the blame.", { supporters: 2, manager: 1.5, teammates: 1, morale: -1 }, "Owning it went down well."),
        answer("bounce", "confident", "One bad day. We'll bounce back next week, no question.", { morale: 1.5, supporters: 0.5, teammates: 0.5 }, "Calm and positive. Nobody minded."),
        answer("blame", "fiery", "Some players need to look at themselves after that.", { teammates: -4, manager: -1.5, supporters: 1, morale: 1 }, "Teammates didn't enjoy reading that."),
      ],
    };
  }
  return {
    id: "result", topic: "result",
    text: rng.pick([`${score} with ${opp(c)}. A point gained or two dropped?`, `Honours even against ${opp(c)}. Happy with that?`]),
    answers: [
      answer("fair", "deflect", "A fair result. We move on.", { manager: 0.5, morale: 0.5 }, "Nothing anyone can argue with."),
      answer("dropped", "confident", "Two points dropped. We should be winning games like that.", { supporters: 1.5, board: 0.5, reputation: 0.2 }, "The fans want that hunger."),
      answer("ref", "fiery", "Ask the referee. I'm not saying any more.", { supporters: 1, manager: -1, reputation: -0.2, board: -1 }, "The board winced; there may be a fine."),
    ],
  };
};

const PERSONAL: Builder = (s, c, rng) => {
  const l = c.line;
  if (c.kind !== "post" || !l) return null;
  if (l.goals >= 2 || l.rating >= 8) {
    return {
      id: "personal", topic: "personal",
      text: l.goals >= 3 ? "A hat-trick. Are you the best striker in the league right now?" : rng.pick(["A standout display today. How do you rate your own form?", `Rated ${l.rating.toFixed(1)} by our panel. Is this the best you've played?`]),
      answers: [
        answer("credit", "humble", "I just finish what the lads create. They deserve the credit.", { teammates: 3, manager: 1, morale: 1 }, "Generous. The forwards' club appreciated it."),
        answer("best", "confident", "I feel unstoppable at the moment. Long may it continue.", { morale: 3, reputation: 0.8, supporters: 1.5, teammates: -0.5 }, "Confidence pours off you. Opponents will have noticed."),
        answer("more", "deflect", "Good, but there's more to come. I'm still learning.", { manager: 2, morale: 1 }, `${manager(s)} liked that attitude.`),
      ],
    };
  }
  if (l.rating <= 5.8 || l.red) {
    return {
      id: "personal", topic: "personal",
      text: l.red ? "You were sent off. Was it a red card?" : rng.pick(["Not your day today. What happened out there?", "Critics are saying you went missing. How do you respond?"]),
      answers: [
        answer("sorry", "humble", l.red ? "I let the lads down. I'll apologise to them." : "I'll be the first to say I wasn't at my level. I'll work harder.", { teammates: 2, manager: 2, morale: -1 }, "Accountability earned respect."),
        answer("critics", "fiery", "The critics can say what they like. I know what I bring.", { morale: 2, supporters: -1.5, reputation: -0.3 }, "Defiant. Not everyone in the stands agreed."),
        answer("move-on", "deflect", "It happens. Next game.", { morale: 0.5 }, "Short and forgettable, which was the point."),
      ],
    };
  }
  return null;
};

const RIVAL: Builder = (s, c, rng) => {
  if (rivalryLevel(s, c.myTeam, c.opponentId) < 0.4) return null;
  const pre = c.kind === "pre";
  return {
    id: "rival", topic: "rivalry",
    text: pre ? `It's ${opp(c)} next. What does this game mean to you?` : rng.pick([`What do these games against ${opp(c)} mean to the supporters?`, `Any message for the ${staticClub(c.opponentId)?.shortName ?? opp(c)} fans?`]),
    answers: [
      answer("respect", "deflect", `Respect to ${opp(c)}. It's just another three points.`, { manager: 1.5, board: 1, supporters: -1 }, "Professional, if a little flat for derby week."),
      answer("everything", "confident", "It means everything. This is the one we all look for.", { supporters: 3, morale: 1.5, teammates: 0.5 }, "The supporters loved it."),
      answer("bigger", "fiery", `We're the bigger club and everyone knows it.`, { supporters: 4, board: -1.5, manager: -1, reputation: 0.3 }, `${opp(c)}'s fans will remember that one.`),
    ],
  };
};

const BIG_GAME: Builder = (_s, c) => {
  if (c.kind !== "pre") return null;
  const stage = c.fixture.stage;
  const big = stage === "Final" || stage === "Semi-final" || c.comp.kind === "continental";
  if (!big) return null;
  return {
    id: "big-game", topic: "preview",
    text: stage === "Final" ? `The ${c.comp.name} final. How are you feeling?` : `${c.comp.name}${stage ? `, ${stage.toLowerCase()}` : ""} against ${opp(c)}. Can you go all the way?`,
    answers: [
      answer("focus", "humble", "One game at a time. We'll respect them and do our jobs.", { manager: 2, morale: 1 }, "Sensible. Exactly what the manager wanted."),
      answer("win-it", "confident", "We're here to win it. Nothing less.", { supporters: 2.5, morale: 2.5, reputation: 0.4 }, "Bold words. Now to back them up."),
      answer("pressure", "deflect", "The pressure's on them, not us.", { morale: 1.5, supporters: 1 }, "Mind games. It might just work."),
    ],
  };
};

const PREVIEW: Builder = (_s, c, rng) => {
  if (c.kind !== "pre") return null;
  return {
    id: "preview", topic: "preview",
    text: rng.pick([`What's the mood in the camp before ${opp(c)}?`, `How do you see the game against ${opp(c)} going?`]),
    answers: [
      answer("good", "humble", "Training's been sharp. We're ready.", { manager: 1, teammates: 1, morale: 1 }, "Nothing to see here, which suits everyone."),
      answer("goals", "confident", "I fancy myself to score. Write that down.", { morale: 2, supporters: 1.5, reputation: 0.3 }, "A promise the fans will hold you to."),
      answer("tough", "deflect", `${opp(c)} are a good side. It'll be tough.`, { manager: 0.5 }, "Polite, cautious, quickly forgotten."),
    ],
  };
};

const TRANSFER: Builder = (s, _c, rng) => {
  const saga = s.user.sagas.find((x) => !x.outcome);
  const offer = s.user.offers.find((o) => (o.status === "terms" || o.status === "club-pending") && o.kind !== "renewal");
  const club = saga?.clubId ?? offer?.fromClubId;
  if (!club) return null;
  return {
    id: "transfer", topic: "transfer",
    text: rng.pick([`There's talk of interest from ${clubName(club)}. Is your future here?`, `Would you be open to joining ${clubName(club)}?`]),
    answers: [
      answer("loyal", "humble", "I'm happy here. My focus is on this club.", { supporters: 3, board: 2, manager: 1 }, "The supporters will hold you to that."),
      answer("open", "confident", "It's flattering. My agent will handle it; we'll see.", { supporters: -2.5, board: -1.5, reputation: 0.6 }, `${clubName(club)} will have liked that answer. Your own fans, less so.`),
      answer("no-comment", "deflect", "I don't comment on rumours.", { board: 0.5 }, "A straight bat. The story rolls on regardless."),
    ],
  };
};

const MINUTES: Builder = (s, c) => {
  // After a standout game nobody asks about a lack of minutes.
  if (c.line && (c.line.rating >= 7.5 || c.line.goals > 0)) return null;
  const p = userPlayer(s);
  let mins = 0;
  for (const k in p.season) mins += p.season[k].minutes;
  const elapsed = s.turn - BALANCE.calendar.seasonStart;
  if (elapsed < 8 || mins > elapsed * 30 || ageOf(p, s.season) > 30) return null;
  return {
    id: "minutes", topic: "playing-time",
    text: "You haven't been playing much this season. Are you frustrated?",
    answers: [
      answer("earn", "humble", "I have to earn my place. I'll keep working.", { manager: 3, morale: -0.5 }, `${manager(s)} noticed. That's how you get picked.`),
      answer("deserve", "fiery", "I think I deserve more minutes, yes.", { manager: -3, supporters: 1.5, morale: 1 }, "Out in the open now. The manager wasn't pleased."),
      answer("trust", "deflect", "I trust the manager's decisions.", { manager: 1.5 }, "Diplomatic. It kept things calm."),
    ],
  };
};

const CONTRACT: Builder = (s) => {
  const p = userPlayer(s);
  if (!p.contract || p.loan || p.contract.expires > s.season) return null;
  return {
    id: "contract", topic: "contract",
    text: "Your contract runs out this summer. Will you sign a new one?",
    answers: [
      answer("stay", "humble", "I'd love to stay. Hopefully we can agree something.", { board: 3, supporters: 2 }, "The board took that as an invitation to talk."),
      answer("options", "confident", "I'm keeping my options open. I've earned that.", { board: -3, supporters: -1.5, reputation: 0.5 }, "Clubs elsewhere will have read that closely."),
      answer("agent", "deflect", "That's for my agent and the club.", { board: 0.5 }, "No headline there."),
    ],
  };
};

const POST: Builder[] = [RESULT, PERSONAL, RIVAL, TRANSFER, CONTRACT, MINUTES];
const PRE: Builder[] = [BIG_GAME, RIVAL, PREVIEW, TRANSFER];

/** Does this match get a press conference? Post-match: notable games always, others now and then. */
export function pressWorthy(state: GameState, ctx: PressContext, rng: Rng): boolean {
  if (ctx.comp.kind === "friendly" || ctx.comp.kind === "international" || state.user.retired) return false;
  const stage = ctx.fixture.stage;
  const big = stage === "Final" || stage === "Semi-final" || ctx.comp.kind === "continental" || rivalryLevel(state, ctx.myTeam, ctx.opponentId) >= 0.4;
  if (ctx.kind === "pre") return big;
  const l = ctx.line;
  if (!l) return false;
  const notable = big || l.goals >= 2 || l.rating >= 8 || l.rating <= 5.6 || l.red > 0 || ctx.res?.motm === l.id;
  return notable || rng.chance(0.2);
}

/** Build and store a press conference for this match, if it earns one. Returns it, or null. */
export function maybePressConference(state: GameState, ctx: PressContext): PressConference | null {
  const rng = Rng.fromSeed(`${state.seed}:press:${ctx.kind}:${ctx.fixture.id}`);
  if (!pressWorthy(state, ctx, rng)) return null;
  const current = state.user.press;
  if (current?.fixtureId === ctx.fixture.id && current.kind === ctx.kind) return null;
  // A pre-match conference never pushes aside one the player has not answered yet.
  if (ctx.kind === "pre" && current && !current.done) return null;
  const builders = ctx.kind === "post" ? POST : PRE;
  const questions: PressQuestion[] = [];
  for (const b of builders) {
    if (questions.length >= 3) break;
    const q = b(state, ctx, rng);
    if (q && !questions.some((x) => x.topic === q.topic)) questions.push({ ...q, ...reporter(rng) });
  }
  if (!questions.length) return null;
  const conf: PressConference = {
    id: nextId(state, "pc"),
    kind: ctx.kind,
    fixtureId: ctx.fixture.id,
    compName: ctx.comp.name,
    opponentId: ctx.opponentId,
    season: state.season,
    turn: state.turn,
    expiresIndex: state.turnIndex + (ctx.kind === "post" ? 2 : 1),
    questions,
    answers: {},
  };
  state.user.press = conf;
  return conf;
}

function applyEffects(state: GameState, e: PressEffects, cause: string): void {
  const p = userPlayer(state);
  for (const k of ["manager", "teammates", "supporters", "board"] as const) if (e[k]) adjustRel(state, k, e[k] as number, cause);
  if (e.morale) p.morale = Math.round(clamp(p.morale + e.morale, 5, 100) * 10) / 10;
  if (e.reputation) p.reputation = Math.round(clamp(p.reputation + e.reputation, 0, 100) * 10) / 10;
}

/** Answer one question. Returns the reaction, or an error message. */
export function answerPress(state: GameState, questionId: string, answerId: string): { ok: boolean; text: string } {
  const conf = state.user.press;
  if (!conf || conf.done) return { ok: false, text: "There's no press conference right now." };
  const q = conf.questions.find((x) => x.id === questionId);
  const a = q?.answers.find((x) => x.id === answerId);
  if (!q || !a) return { ok: false, text: "That answer isn't available." };
  if (conf.answers[q.id]) return { ok: false, text: "You've already answered that." };
  conf.answers[q.id] = a.id;
  applyEffects(state, a.effects, `Press conference: "${a.label}"`);
  if (conf.questions.every((x) => conf.answers[x.id])) finishPress(state);
  return { ok: true, text: a.reaction };
}

function headlineFor(state: GameState, conf: PressConference): { headline: string; tone: PressTone } {
  const tones = conf.questions.map((q) => q.answers.find((a) => a.id === conf.answers[q.id])?.tone).filter((t): t is PressTone => !!t);
  const count = (t: PressTone) => tones.filter((x) => x === t).length;
  const order: PressTone[] = ["fiery", "confident", "humble", "deflect"];
  const tone = order.reduce((best, t) => (count(t) > count(best) ? t : best), order[0]);
  const p = userPlayer(state);
  const last = p.lastName;
  const loud = conf.questions.flatMap((q) => q.answers.filter((a) => a.id === conf.answers[q.id] && a.tone === tone));
  const quote = loud[0]?.label ?? "";
  const lead =
    tone === "fiery" ? `${last} fires back` : tone === "confident" ? `Confident ${last}` : tone === "humble" ? `${last} keeps feet on the ground` : `${last} gives little away`;
  return { headline: `${lead}: "${quote.replace(/\.$/, "")}"`, tone };
}

function finishPress(state: GameState): void {
  const conf = state.user.press;
  if (!conf || conf.done) return;
  conf.done = true;
  const { headline, tone } = headlineFor(state, conf);
  conf.headline = headline;
  addNews(state, { kind: "club", title: `🎙️ ${headline}`, body: `${conf.kind === "pre" ? "Pre-match" : "Post-match"} press conference · ${conf.compName} · ${clubName(conf.opponentId)}` });
  const log = (state.user.pressLog ??= []);
  log.push({ season: conf.season, turn: conf.turn, kind: conf.kind, opponentId: conf.opponentId, headline, tone, fixtureId: conf.fixtureId });
  if (log.length > PRESS_LOG_CAP) log.splice(0, log.length - PRESS_LOG_CAP);
}

/** Skip the press: no effects either way, but they notice when it keeps happening. */
export function skipPress(state: GameState): void {
  const conf = state.user.press;
  if (!conf || conf.done) return;
  const skipped = (state.user.pressSkips ?? 0) + 1;
  state.user.pressSkips = skipped;
  if (skipped >= 3) {
    adjustRel(state, "board", -1, "Kept dodging the press");
    state.user.pressSkips = 0;
  }
  state.user.press = undefined;
}

/** Weekly: lapse a conference nobody answered, or a pre-match one whose game has been played. */
export function expirePress(state: GameState): void {
  const conf = state.user.press;
  if (!conf) return;
  if (conf.done) {
    if (state.turnIndex > conf.expiresIndex) state.user.press = undefined;
    return;
  }
  const played = conf.kind === "pre" && Object.values(state.competitions).some((c) => c.fixtures.some((f) => f.id === conf.fixtureId && !!f.result));
  if (played || state.turnIndex > conf.expiresIndex) state.user.press = undefined;
}

export function pendingPress(state: GameState): PressConference | null {
  const c = state.user.press;
  return c && !c.done ? c : null;
}

export function sanitizePress(state: GameState): void {
  const u = state.user;
  if (!u) return;
  const c = u.press;
  if (c && (typeof c !== "object" || !Array.isArray(c.questions) || !c.questions.length || typeof c.answers !== "object")) u.press = undefined;
  u.pressLog = Array.isArray(u.pressLog) ? u.pressLog.filter((e) => e && typeof e.headline === "string").slice(-PRESS_LOG_CAP) : [];
}
