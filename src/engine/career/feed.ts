/**
 * The social feed: fictional fans, rival fans, journalists and pundits reacting to the player's career.
 * Posts are flavour only and never change the game. Every post is drawn from its own seeded stream
 * (seed + event key), so the feed never moves the world's RNG and the same career always reads the same.
 */
import { clubName, staticClub } from "../data/world";
import { poolFor } from "../data/names";
import { rivalryLevel } from "../memory/rivalry";
import type { MatchResult, PlayerLine } from "../match/engine";
import { Rng } from "../rng";
import type { Competition, FeedAuthorKind, FeedPost, Fixture, GameState } from "../types";
import { userPlayer } from "../world/helpers";

export const FEED_CAP = 80;

const short = (id: string | null | undefined) => (id ? staticClub(id)?.shortName ?? clubName(id, true) : "Football");
const tag = (s: string) => s.replace(/[^A-Za-z0-9]/g, "");

function fanHandle(rng: Rng, clubId: string): { name: string; handle: string } {
  const c = tag(short(clubId));
  const pool = poolFor("english");
  const first = rng.pick(pool.first);
  const style = rng.int(0, 4);
  const handle = [`${c}Faithful`, `${first}${c}${rng.int(70, 99)}`, `${c}TillIDie`, `TheReal${c}Terrace`, `${first}_${c}`][style];
  return { name: style === 1 || style === 4 ? first : `${short(clubId)} fan`, handle: `@${handle}` };
}

function journalist(rng: Rng): { name: string; handle: string } {
  const pool = poolFor(rng.pick(["english", "spanish", "italian", "german", "french"]));
  const f = rng.pick(pool.first);
  const l = rng.pick(pool.last);
  return { name: `${f} ${l}`, handle: `@${f[0]}${l}${rng.pick(["Football", "Sport", "FC", "Reports", ""])}` };
}

const PUNDITS = [
  { name: "The Tactics Board", handle: "@TacticsBoardPod" },
  { name: "Ninety Minutes", handle: "@90MinutesShow" },
  { name: "Stats Corner", handle: "@StatsCornerFC" },
  { name: "Old Pro", handle: "@OldProSays" },
];

/** Engagement grows with the player's fame; quieter careers get quieter posts. */
function engagement(state: GameState, rng: Rng, weight = 1): { likes: number; reposts: number } {
  const rep = userPlayer(state)?.reputation ?? 30;
  const base = (15 + Math.pow(rep / 10, 3.1)) * weight;
  const likes = Math.max(1, Math.round(base * rng.range(0.5, 1.6)));
  return { likes, reposts: Math.round(likes * rng.range(0.05, 0.22)) };
}

function push(state: GameState, post: Omit<FeedPost, "id" | "season" | "turn">, key: string): void {
  const feed = (state.user.feed ??= []);
  const id = `fp:${key}`;
  if (feed.some((p) => p.id === id)) return;
  feed.push({ ...post, id, season: state.season, turn: state.turn });
  if (feed.length > FEED_CAP) feed.splice(0, feed.length - FEED_CAP);
}

function post(state: GameState, rng: Rng, key: string, kind: FeedAuthorKind, who: { name: string; handle: string }, text: string, mood: FeedPost["mood"], topic: FeedPost["topic"], weight = 1): void {
  push(state, { kind, author: who.name, handle: who.handle, text, mood, topic, ...engagement(state, rng, weight) }, key);
}

export interface FeedMatchContext {
  comp: Competition;
  fixture: Fixture;
  res: MatchResult;
  line: PlayerLine;
  mine: number;
  theirs: number;
  myTeam: string;
  opponent: string;
  nat: boolean;
}

/** Two to four reactions to one of the player's matches. */
export function feedAfterMatch(state: GameState, c: FeedMatchContext): void {
  const rng = Rng.fromSeed(`${state.seed}:feed:${c.fixture.id}`);
  const p = userPlayer(state);
  const me = p.lastName;
  const l = c.line;
  const won = c.mine > c.theirs;
  const lost = c.mine < c.theirs;
  const score = `${c.mine}-${c.theirs}`;
  const team = c.nat ? c.myTeam : short(c.myTeam);
  const vs = c.nat ? c.opponent : short(c.opponent);
  const hashtag = c.nat ? "" : ` #${tag(short(c.myTeam))}${tag(short(c.opponent)).slice(0, 3).toUpperCase()}`;
  const great = l.rating >= 8 || l.goals >= 2;
  const poor = l.rating < 6;
  const k = c.fixture.id;

  // A home fan.
  const fan = c.nat ? { name: `${c.myTeam} supporter`, handle: `@${c.myTeam}Ultras` } : fanHandle(rng, c.myTeam);
  const fanText = great
    ? rng.pick([`${me.toUpperCase()}!!! What a player. ${score}${hashtag}`, `Give ${me} whatever he wants. Different class today.`, `${l.goals >= 3 ? "HAT-TRICK HERO" : "Man of the moment"} ${me}. Get him a new contract now.`, `Been watching ${team} 30 years. ${me} is the real deal.`])
    : poor && lost
      ? rng.pick([`${me} was invisible today. Not good enough.`, `Can't keep picking ${me} on that form. ${score}, embarrassing.`, `Where was ${me}? Honestly.`])
      : won
        ? rng.pick([`Three points, job done. ${score}${hashtag}`, `Good win. ${me} worked his socks off.`, `${team} on the up. Love this side.`])
        : lost
          ? rng.pick([`Gutted. ${score}. Need a response next week.`, `Not our day. Heads up, lads.`, `Poor from everyone today, not just one player.`])
          : rng.pick([`A point. Could've been more.`, `${score}. Fair enough, I suppose.`, `Frustrating. We had chances.`]);
  post(state, rng, `${k}:fan`, "fan", fan, fanText, great || won ? "pos" : lost || poor ? "neg" : "neutral", "match", great ? 1.4 : 1);

  // A journalist's line.
  const j = journalist(rng);
  const jText = l.goals > 0
    ? `FT: ${team} ${score} ${vs}. ${p.firstName[0]}. ${me} with ${l.goals === 1 ? "the goal" : `${l.goals} goals`}${l.assists ? ` and ${l.assists} assist${l.assists > 1 ? "s" : ""}` : ""}. Rated ${l.rating.toFixed(1)}.`
    : `FT: ${team} ${score} ${vs} (${c.comp.name}). ${me}: ${l.rating.toFixed(1)}. ${great ? "Outstanding." : poor ? "A day to forget." : "Steady."}`;
  post(state, rng, `${k}:press`, "journalist", j, jText, "neutral", "match", 0.8);

  // Rival fans, in derbies or when they've had something to shout about.
  if (!c.nat && (rivalryLevel(state, c.myTeam, c.opponent) >= 0.4 || (lost && rng.chance(0.4)) || (great && rng.chance(0.35)))) {
    const rf = fanHandle(rng, c.opponent);
    const rText = lost
      ? rng.pick([`Bye bye ${team} 👋 ${score}`, `${me}? Overrated. Told you all.`, `Easiest three points of the season.`])
      : great
        ? rng.pick([`Hate to admit it but ${me} was class today.`, `How is ${me} not playing for a bigger club? Painful.`, `We had no answer to ${me}. Fair play.`])
        : rng.pick([`Ref gave them everything. Shocking.`, `${team} fans acting like they won the league 😂`, `Same old ${team}.`]);
    post(state, rng, `${k}:rival`, "rival-fan", rf, rText, lost ? "neg" : great ? "pos" : "neg", "match");
  }

  // Pundits pick up big performances and bad days.
  if (great || poor || c.fixture.stage === "Final") {
    const pd = rng.pick(PUNDITS);
    const pText = great
      ? rng.pick([`${me}'s movement today was elite. ${l.goals ? "Finishing to match." : "Ran the game."}`, `If ${me} keeps this up, the big clubs will come calling. Mark my words.`, `Rating of ${l.rating.toFixed(1)}. Best we've seen from ${me} this season.`])
      : poor
        ? rng.pick([`${me} looks short of confidence. Needs an arm round the shoulder.`, `Tough one for ${me}. The manager has a decision to make.`])
        : `${c.comp.name} final: ${team} ${score} ${vs}. What a stage.`;
    post(state, rng, `${k}:pundit`, "pundit", pd, pText, great ? "pos" : poor ? "neg" : "neutral", "match", 1.2);
  }
}

/** Reactions to things that happened during the week: moves, trophies, awards, injuries. */
export function feedWeekly(state: GameState): void {
  const u = state.user;
  if (u.retired) return;
  const seen = (u.feedSeen ??= { transfers: 0, trophies: 0, awards: 0, injuries: 0 });
  const p = userPlayer(state);
  const me = p.lastName;
  for (let i = seen.transfers; i < u.transfers.length; i++) {
    const t = u.transfers[i];
    const rng = Rng.fromSeed(`${state.seed}:feed:t${i}`);
    const fee = t.fee >= 1_000_000 ? `€${(t.fee / 1_000_000).toFixed(1)}m` : t.fee > 0 ? `€${Math.round(t.fee / 1000)}k` : "";
    post(state, rng, `t${i}:j`, "journalist", journalist(rng), `CONFIRMED: ${p.firstName} ${me} joins ${clubName(t.to)}${t.kind === "loan" ? " on loan" : ""}${t.from ? ` from ${clubName(t.from)}` : ""}${fee ? `. Fee: ${fee}` : ""}. Here we go! ✍️`, "neutral", "transfer", 1.5);
    post(state, rng, `t${i}:fan`, "fan", fanHandle(rng, t.to), rng.pick([`Welcome to ${short(t.to)}, ${me}! 🙌`, `Big signing. Can't wait to see ${me} in our colours.`, `${me}... not sure about this one. Prove me wrong.`]), "pos", "transfer");
    if (t.from && t.kind !== "loan") post(state, rng, `t${i}:old`, "fan", fanHandle(rng, t.from), rng.pick([`Thanks for everything, ${me}. 💙`, `Sold to a rival? Never forgiving this.`, `Good business. Best of luck.`]), rng.chance(0.5) ? "pos" : "neg", "transfer");
  }
  for (let i = seen.trophies; i < u.trophies.length; i++) {
    const t = u.trophies[i];
    const rng = Rng.fromSeed(`${state.seed}:feed:tr${i}`);
    const club = t.clubId ?? null;
    post(state, rng, `tr${i}:club`, "club", { name: club ? clubName(club) : t.country ?? "National team", handle: `@${tag(club ? short(club) : t.country ?? "Nation")}Official` }, `🏆 ${t.name.toUpperCase()} WINNERS! 🏆 What a season. Thank you, supporters.`, "pos", "trophy", 3);
    post(state, rng, `tr${i}:fan`, "fan", club ? fanHandle(rng, club) : { name: "Supporter", handle: "@NationalPride" }, rng.pick([`WE ARE THE CHAMPIONS! ${me} you legend!`, `Crying. Actual tears. ${t.name} is ours.`, `Party in the streets tonight 🎉`]), "pos", "trophy", 2);
  }
  for (let i = seen.awards; i < u.awards.length; i++) {
    const a = u.awards[i];
    if (a.id === "totw") continue;
    const rng = Rng.fromSeed(`${state.seed}:feed:aw${i}`);
    post(state, rng, `aw${i}:j`, "journalist", journalist(rng), `${p.firstName} ${me} wins ${a.name}${a.scope ? ` (${a.scope})` : ""}. ${a.value ? `${a.value}.` : "Deserved."}`, "pos", "award", a.id === "potm" ? 1 : 2);
  }
  for (let i = seen.injuries; i < u.injuryHistory.length; i++) {
    const inj = u.injuryHistory[i];
    if (inj.weeks < 3) continue;
    const rng = Rng.fromSeed(`${state.seed}:feed:in${i}`);
    post(state, rng, `in${i}:j`, "journalist", journalist(rng), `Injury news: ${me} is expected to miss ${inj.weeks} weeks with a ${inj.type.toLowerCase()}.`, "neg", "injury");
    if (p.clubId) post(state, rng, `in${i}:fan`, "fan", fanHandle(rng, p.clubId), rng.pick([`Devastating news about ${me}. Get well soon. 🙏`, `Season over? Please no.`, `Huge blow. We need him back.`]), "neg", "injury");
  }
  u.feedSeen = { transfers: u.transfers.length, trophies: u.trophies.length, awards: u.awards.length, injuries: u.injuryHistory.length };
}

/** The back pages pick up a press conference headline. */
export function feedAfterPress(state: GameState, headline: string, tone: string, key: string): void {
  const rng = Rng.fromSeed(`${state.seed}:feed:pc:${key}`);
  const p = userPlayer(state);
  post(state, rng, `pc:${key}:j`, "journalist", journalist(rng), `🎙️ ${headline}`, "neutral", "press", 1.1);
  const fan = p.clubId ? fanHandle(rng, p.clubId) : { name: "Supporter", handle: "@Terrace" };
  const text = tone === "fiery" ? rng.pick([`Love the passion from ${p.lastName}! 🔥`, `${p.lastName} saying what we're all thinking.`, `Bit much from ${p.lastName}, that.`]) : tone === "humble" ? rng.pick([`Class act, ${p.lastName}.`, `This is why we love him.`]) : tone === "confident" ? rng.pick([`Confidence! That's what we want to hear.`, `Big words. Back them up, ${p.lastName}.`]) : rng.pick([`Says nothing, as usual 😴`, `Media-trained to perfection.`]);
  post(state, rng, `pc:${key}:fan`, "fan", fan, text, tone === "fiery" ? "neutral" : "pos", "press");
}

/** A big achievement gets a mention. */
export function feedAfterAchievement(state: GameState, id: string, name: string, icon: string): void {
  const rng = Rng.fromSeed(`${state.seed}:feed:ach:${id}`);
  const p = userPlayer(state);
  post(state, rng, `ach:${id}`, "pundit", rng.pick(PUNDITS), `${icon} ${p.firstName} ${p.lastName}: ${name}. One for the scrapbook.`, "pos", "achievement", 1.3);
}

export function feedNewestFirst(state: GameState, limit = FEED_CAP): FeedPost[] {
  return [...(state.user.feed ?? [])].reverse().slice(0, limit);
}

export function sanitizeFeed(state: GameState): void {
  const u = state.user;
  if (!u) return;
  u.feed = Array.isArray(u.feed) ? u.feed.filter((p) => p && typeof p.id === "string" && typeof p.text === "string").slice(-FEED_CAP) : [];
  // An older save starts reacting from now on, not to its whole history at once.
  const ok = u.feedSeen && typeof u.feedSeen === "object" && ["transfers", "trophies", "awards", "injuries"].every((k) => Number.isFinite((u.feedSeen as Record<string, number>)[k]));
  if (!ok) u.feedSeen = { transfers: u.transfers?.length ?? 0, trophies: u.trophies?.length ?? 0, awards: u.awards?.length ?? 0, injuries: u.injuryHistory?.length ?? 0 };
}
