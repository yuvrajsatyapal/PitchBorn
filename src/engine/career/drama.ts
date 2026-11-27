/**
 * Off-pitch drama: longer stories with more than one beat, built on relationships, chemistry and the contract.
 *
 *  - Contract stand-off: talks stall in the final year. Going public pressures the club (it may improve its offer or
 *    dig in) at a cost with the board and the fans.
 *  - Dressing-room cliques: the young guns against the senior pros. Pick a side, or try to bring them together.
 *  - Falling out with the manager: a row that can be patched up, escalate to being frozen out, or go to the board.
 *  - Captaincy race: when the armband is up for grabs, a six-week race against a teammate decided by form and standing.
 *
 * One story at a time, with quiet weeks between them. Randomness comes from `Rng.fromSeed(seed:drama:…)` streams so
 * the world RNG never moves.
 */
import { clubName } from "../data/world";
import { rememberCaptaincy } from "../memory/detect";
import { addStintEvent } from "../managers/history";
import { overallFor } from "../players/attributes";
import { ageOf } from "../players/generate";
import { clamp, Rng } from "../rng";
import { negotiationPatience } from "../traits/career";
import { careerProfile } from "../traits/effects";
import type { CareerDecision, DramaKind, DramaState, DramaStory, GameState, Player } from "../types";
import { addNews, addTimeline, fullName, nextId, userPlayer } from "../world/helpers";
import { nudgeBond } from "./chemistry";
import { makeTerms, setTransferRequest } from "./offers";
import { adjustRel } from "./relationships";

const D = {
  /** Weekly chance a story starts when one is eligible. */
  startChance: 0.025,
  /** Quiet weeks after a story ends. */
  quiet: 14,
  /** Weeks before the same kind of story can come back (cliques, the commonest, wait two seasons). */
  repeatAfter: { standoff: 45, clique: 95, fallout: 45, captaincy: 45 } as Record<DramaKind, number>,
  /** How often each eligible kind is picked: the rarer, bigger stories first. */
  weight: { standoff: 3, captaincy: 3, fallout: 2, clique: 1 } as Record<DramaKind, number>,
  raceWeeks: 6,
};

export const TITLES: Record<DramaKind, string> = {
  standoff: "Contract stand-off",
  clique: "Dressing-room cliques",
  fallout: "Falling out with the manager",
  captaincy: "Captaincy race",
};

export function dramaOf(state: GameState): DramaState {
  return (state.user.drama ??= { log: [], quietUntil: 0 });
}

const rng = (state: GameState, tag: string) => Rng.fromSeed(`${state.seed}:drama:${tag}:${state.turnIndex}`);

function squadMates(state: GameState, p: Player): Player[] {
  if (!p.clubId) return [];
  return (state.clubs[p.clubId]?.squad ?? []).map((id) => state.players[id]).filter((x): x is Player => !!x && x.id !== p.id && !x.retired);
}

function captaincyRival(state: GameState, p: Player): Player | undefined {
  const club = p.clubId ? state.clubs[p.clubId] : undefined;
  if (!club) return undefined;
  return squadMates(state, p)
    .filter((m) => m.id !== club.captain && ageOf(m, state.season) >= 24)
    .sort((a, b) => b.reputation + careerProfile(b).leader * 20 - (a.reputation + careerProfile(a).leader * 20))[0];
}

function armbandOpen(state: GameState, p: Player): boolean {
  const club = p.clubId ? state.clubs[p.clubId] : undefined;
  if (!club || club.captain === p.id || ageOf(p, state.season) < 23 || !p.contract) return false;
  const cap = club.captain ? state.players[club.captain] : undefined;
  return !cap || cap.retired || cap.clubId !== club.id || ageOf(cap, state.season) >= 33;
}

function camps(state: GameState, p: Player): DramaStory["camps"] | undefined {
  const mates = squadMates(state, p);
  const young = mates.filter((m) => ageOf(m, state.season) <= 24).map((m) => m.id);
  const senior = mates.filter((m) => ageOf(m, state.season) >= 29).map((m) => m.id);
  if (young.length < 4 || senior.length < 4) return undefined;
  return { a: { name: "the young guns", ids: young.slice(0, 8) }, b: { name: "the senior pros", ids: senior.slice(0, 8) } };
}

export function eligibleDrama(state: GameState, p: Player): DramaKind[] {
  const out: DramaKind[] = [];
  const left = p.contract ? p.contract.expires - state.season : 9;
  const talks = state.user.offers.some((o) => o.kind === "renewal" && (o.status === "terms" || o.status === "club-pending"));
  if (p.contract && !p.loan && left <= 1 && state.turn >= 10 && state.turn <= 42 && !talks && p.reputation >= 30) out.push("standoff");
  if (state.user.relationships.manager < 38 && p.clubId) out.push("fallout");
  if (armbandOpen(state, p) && captaincyRival(state, p)) out.push("captaincy");
  if (Object.keys(state.user.chemistry ?? {}).length >= 6 && camps(state, p)) out.push("clique");
  const last = state.user.drama?.lastByKind ?? {};
  return out.filter((k) => last[k] === undefined || state.turnIndex - (last[k] as number) >= D.repeatAfter[k]);
}

/** Weekly: start a story or play its next beat. */
export function dramaWeekly(state: GameState): void {
  const u = state.user;
  if (u.retired || u.coach) return;
  const p = userPlayer(state);
  const d = dramaOf(state);
  const pendingDecision = u.decisions.some((x) => x.handler === "drama");
  if (d.active) {
    if (d.active.clubId !== p.clubId) {
      end(state, "moved on");
      return;
    }
    if (!pendingDecision && state.turnIndex >= d.active.next) beat(state, d.active, p);
    return;
  }
  if (state.turnIndex < d.quietUntil || pendingDecision || u.decisions.length >= 2 || !p.clubId) return;
  const r = rng(state, "start");
  const kinds = eligibleDrama(state, p);
  if (!kinds.length || !r.chance(D.startChance)) return;
  startDrama(state, r.weighted(kinds, (k) => D.weight[k]));
}

export function startDrama(state: GameState, kind: DramaKind): DramaStory | undefined {
  const p = userPlayer(state);
  const d = dramaOf(state);
  const story: DramaStory = { id: nextId(state, "dr"), kind, stage: 0, started: state.turnIndex, next: state.turnIndex, clubId: p.clubId ?? "" };
  const club = clubName(p.clubId);
  if (kind === "captaincy") {
    const rival = captaincyRival(state, p);
    if (!rival) return undefined;
    story.rivalId = rival.id;
    story.score = (state.user.relationships.manager - 50) / 10 + (careerProfile(p).leader - careerProfile(rival).leader) * 3;
    story.next = state.turnIndex + D.raceWeeks;
    d.active = story;
    addNews(state, { kind: "club", title: "🎗️ Race for the armband", body: `${club} need a new captain. It's between you and ${fullName(rival)}.`, important: true });
    ask(state, story, "The armband is up for grabs", `The manager will name a new captain in ${D.raceWeeks} weeks. ${fullName(rival)} wants it too. How do you go about it?`, [
      { id: "campaign", label: "Campaign in the dressing room", hint: "Win teammates over; the manager may find it presumptuous" },
      { id: "football", label: "Let your football do the talking", hint: "Form decides it" },
      { id: "back-rival", label: `Back ${rival.lastName} for it`, hint: "Step aside gracefully; teammates respect it" },
    ], "football");
    return story;
  }
  if (kind === "clique") {
    const c = camps(state, p);
    if (!c) return undefined;
    story.camps = c;
    d.active = story;
    const names = (ids: string[]) => ids.slice(0, 2).map((id) => state.players[id]?.lastName).filter(Boolean).join(" and ");
    ask(state, story, "The dressing room is splitting", `Two camps have formed at ${club}: ${c.a.name} around ${names(c.a.ids)}, and ${c.b.name} around ${names(c.b.ids)}. Both expect you to pick a side.`, [
      { id: "side-a", label: `Side with ${c.a.name}`, hint: "Closer to them, colder with the others" },
      { id: "side-b", label: `Side with ${c.b.name}`, hint: "Closer to them, colder with the others" },
      { id: "bridge", label: "Try to bring them together", hint: "Leaders pull it off; it can backfire" },
    ], "bridge");
    return story;
  }
  if (kind === "fallout") {
    d.active = story;
    ask(state, story, "A row with the manager", "Words were exchanged on the training ground and the squad saw all of it. The manager is waiting to see what you do next.", [
      { id: "apologise", label: "Apologise privately", hint: "Mends things; you swallow some pride" },
      { id: "firm", label: "Stand your ground", hint: "Teammates respect it; the manager may freeze you out" },
      { id: "board", label: "Take it to the board", hint: "High risk: depends on how much the club needs you" },
    ], "apologise");
    return story;
  }
  d.active = story;
  ask(state, story, "Contract talks have stalled", `Your deal at ${club} runs out at the end of the season and there is no new offer on the table. Your agent wants to know how hard to push.`, [
    { id: "public", label: "Go public with your demands", hint: "Pressure on the club; the board and fans won't like it" },
    { id: "quiet", label: "Let your agent work quietly", hint: "Slower, but no bad blood" },
    { id: "sign", label: "Ask for their best offer now", hint: "Talks open straight away" },
  ], "quiet");
  return story;
}

function ask(state: GameState, story: DramaStory, title: string, body: string, options: CareerDecision["options"], fallback: string) {
  state.user.decisions.push({ id: nextId(state, "d"), kind: "event", handler: "drama", ref: story.id, eventId: `drama-${story.kind}`, title, body, options, fallback, expiresTurn: state.turn + 2, season: state.season });
}

function end(state: GameState, outcome: string): void {
  const d = dramaOf(state);
  const s = d.active;
  if (!s) return;
  d.log.push({ season: state.season, kind: s.kind, title: TITLES[s.kind], outcome });
  if (d.log.length > 20) d.log.shift();
  (d.lastByKind ??= {})[s.kind] = state.turnIndex;
  d.active = undefined;
  d.quietUntil = state.turnIndex + D.quiet;
}

function openRenewal(state: GameState, p: Player, premium: number, note: string): boolean {
  const club = p.contract ? state.clubs[p.contract.clubId] : undefined;
  if (!club || !p.contract) return false;
  const r = rng(state, "terms");
  const { terms, maxWage } = makeTerms(state, r, club, p, "renewal");
  terms.wage = Math.round((terms.wage * premium) / 100) * 100;
  state.user.offers = state.user.offers.filter((o) => !(o.kind === "renewal" && o.status === "terms"));
  state.user.offers.unshift({
    id: nextId(state, "o"), kind: "renewal", fromClubId: club.id, toPlayerClubId: club.id, fee: 0, terms, maxWage: Math.round(maxWage * premium), patience: negotiationPatience(p, r.int(2, 3)),
    status: "terms", createdTurn: state.turn, expiresTurn: state.turn + 6, season: state.season, history: [note],
  });
  addNews(state, { kind: "contract", title: "New contract offer", body: note, important: true });
  return true;
}

/** The club's valuation of the user: positive when he is better than its level. */
function valued(state: GameState, p: Player): number {
  const club = p.clubId ? state.clubs[p.clubId] : undefined;
  if (!club) return 0;
  return overallFor(p.attrs, p.position) - (club.reputation * 0.45 + 38);
}

/** Resolve the decision of a story's current beat. */
export function resolveDrama(state: GameState, dec: CareerDecision, optionId: string): string {
  const d = dramaOf(state);
  const s = d.active;
  const p = userPlayer(state);
  if (!s || s.id !== dec.ref) return "The moment has passed.";
  const opt = dec.options.find((o) => o.id === optionId) ?? dec.options.find((o) => o.id === dec.fallback);
  const id = opt?.id ?? dec.fallback;
  const club = clubName(s.clubId);
  if (s.stage === 0) s.choice = id;
  switch (`${s.kind}:${s.stage}:${id}`) {
    case "standoff:0:public":
      adjustRel(state, "board", -8, "Went public over your contract");
      adjustRel(state, "supporters", -5, "Went public over your contract");
      adjustRel(state, "manager", -3, "Went public over your contract");
      addNews(state, { kind: "contract", title: `📰 Stand-off: ${p.lastName} goes public`, body: `You tell reporters you want a deal that reflects your value. ${club} have two weeks to respond.`, important: true });
      s.stage = 1;
      s.next = state.turnIndex + 2;
      return "The story is everywhere. The club will respond.";
    case "standoff:0:quiet":
      s.stage = 1;
      s.next = state.turnIndex + 3;
      return "Your agent keeps talking behind closed doors.";
    case "standoff:0:sign":
      openRenewal(state, p, 1, `${club} put their best offer on the table.`);
      end(state, "asked for the best offer");
      return "Talks are open.";
    case "clique:0:side-a":
    case "clique:0:side-b": {
      const c = s.camps;
      if (!c) break;
      const [mine, theirs] = id === "side-a" ? [c.a, c.b] : [c.b, c.a];
      for (const m of mine.ids) nudgeBond(state, m, 8);
      for (const m of theirs.ids) nudgeBond(state, m, -8);
      adjustRel(state, "teammates", -1, `Sided with ${mine.name}`);
      end(state, `sided with ${mine.name}`);
      return `You side with ${mine.name}. The others won't forget it.`;
    }
    case "clique:0:bridge": {
      const lead = clamp(0.35 + careerProfile(p).leader * 0.3 + (state.user.relationships.teammates - 50) / 150, 0.1, 0.85);
      const ok = rng(state, "bridge").chance(lead);
      for (const m of [...(s.camps?.a.ids ?? []), ...(s.camps?.b.ids ?? [])]) nudgeBond(state, m, ok ? 3 : -2);
      adjustRel(state, "teammates", ok ? 6 : -3, ok ? "Brought the dressing room together" : "A failed attempt to unite the dressing room");
      if (ok) adjustRel(state, "manager", 3, "Brought the dressing room together");
      addNews(state, { kind: "club", title: ok ? "🤝 Peace in the dressing room" : "The split deepens", body: ok ? "A team dinner you organised clears the air. The camps are mixing again." : "Your attempt to bring the camps together falls flat.", important: true });
      end(state, ok ? "united the squad" : "the split deepened");
      return ok ? "You pulled it off." : "It didn't work.";
    }
    case "fallout:0:apologise":
      adjustRel(state, "manager", 8, "Apologised after a row");
      p.morale = clamp(p.morale - 3, 0, 100);
      end(state, "apologised");
      return "The manager accepts. Back to work.";
    case "fallout:0:firm":
      adjustRel(state, "manager", -8, "Stood your ground in a row");
      adjustRel(state, "teammates", 3, "Stood your ground in a row");
      addStintEvent(state, "fallout");
      s.stage = 1;
      s.next = state.turnIndex + 3;
      return "Neither of you backs down.";
    case "fallout:0:board": {
      const big = valued(state, p) >= 2 || p.reputation >= 65;
      adjustRel(state, "manager", -14, "Went over the manager's head");
      adjustRel(state, "board", big ? 4 : -8, "Went to the board about the manager");
      addStintEvent(state, "fallout");
      addNews(state, { kind: "club", title: big ? "Board side with you" : "Board back the manager", body: big ? "The board make it clear to the manager that you are central to their plans." : "The board tell you the manager runs the dressing room.", important: true });
      end(state, big ? "the board backed you" : "the board backed the manager");
      return big ? "The board side with you." : "The board side with the manager.";
    }
    case "fallout:1:request":
      setTransferRequest(state, true);
      end(state, "handed in a transfer request");
      return "You want out.";
    case "fallout:1:bide":
      adjustRel(state, "manager", 4, "Kept your head down after being frozen out");
      end(state, "kept your head down");
      return "You keep working and wait for your chance.";
    case "captaincy:0:campaign":
      s.score = (s.score ?? 0) + 2;
      adjustRel(state, "teammates", 3, "Campaigned for the captaincy");
      adjustRel(state, "manager", -1, "Campaigned for the captaincy");
      return "You start working the room.";
    case "captaincy:0:football":
      return "Form will decide it.";
    case "captaincy:0:back-rival": {
      const rival = s.rivalId ? state.players[s.rivalId] : undefined;
      const c = state.clubs[s.clubId];
      if (rival && c) c.captain = rival.id;
      if (rival) nudgeBond(state, rival.id, 15);
      adjustRel(state, "teammates", 5, "Backed a teammate for captain");
      addNews(state, { kind: "club", title: `${rival ? fullName(rival) : "A teammate"} named captain`, body: "You backed your teammate for the armband and the dressing room noticed." });
      end(state, "backed the rival");
      return "A gracious move.";
    }
  }
  return `You chose: ${opt?.label ?? id}.`;
}

/** Score in the captaincy race: positive means the user is ahead. */
function raceLead(state: GameState, s: DramaStory, p: Player, rival: Player): number {
  return (s.score ?? 0) + (p.form - rival.form) * 4 + (state.user.relationships.teammates - 55) / 15;
}

/** The next beat of a running story, when no decision is waiting. */
function beat(state: GameState, s: DramaStory, p: Player): void {
  const club = clubName(s.clubId);
  if (s.kind === "standoff" && s.stage === 1) {
    if (s.choice === "public") {
      const blink = rng(state, "blink").chance(clamp(0.4 + valued(state, p) / 12, 0.15, 0.85));
      if (blink) {
        openRenewal(state, p, 1.15, `${club} blink first: an improved offer arrives after your public stand.`);
        end(state, "the club blinked");
      } else {
        adjustRel(state, "supporters", -3, "The club refused to budge on your contract");
        addNews(state, { kind: "contract", title: `${club} dig in`, body: "The club say no player is bigger than the club. No new offer is coming.", important: true });
        end(state, "the club dug in");
      }
      return;
    }
    openRenewal(state, p, 1.03, `Your agent's quiet work pays off: ${club} offer a new contract.`);
    end(state, "talks opened quietly");
    return;
  }
  if (s.kind === "fallout" && s.stage === 1) {
    if (state.user.relationships.manager < 32) {
      addNews(state, { kind: "club", title: "🥶 Frozen out", body: "The manager leaves you out of a training drill and doesn't say a word. The message is clear.", important: true });
      adjustRel(state, "manager", -4, "Frozen out by the manager");
      s.next = Number.MAX_SAFE_INTEGER;
      ask(state, s, "Frozen out", "Do you push for a move or keep your head down?", [
        { id: "request", label: "Hand in a transfer request", hint: "Clubs are alerted; the board and fans are hurt" },
        { id: "bide", label: "Bide your time", hint: "Work hard and hope it blows over" },
      ], "bide");
    } else {
      adjustRel(state, "manager", 6, "Cleared the air with the manager");
      addNews(state, { kind: "club", title: "Clearing the air", body: "You and the manager talk it through. It's forgotten." });
      end(state, "cleared the air");
    }
    return;
  }
  if (s.kind === "captaincy") {
    const rival = s.rivalId ? state.players[s.rivalId] : undefined;
    const c = state.clubs[s.clubId];
    if (!c) return end(state, "the club moved on");
    if (!rival || rival.clubId !== s.clubId || raceLead(state, s, p, rival) >= 0) {
      c.captain = p.id;
      crown(state, s, p);
      return;
    }
    c.captain = rival.id;
    addNews(state, { kind: "club", title: `${fullName(rival)} named captain`, body: "The manager goes with your rival. You will have to wait.", important: true });
    p.morale = clamp(p.morale - 4, 0, 100);
    end(state, "lost to the rival");
  }
}

function crown(state: GameState, s: DramaStory, p: Player) {
  rememberCaptaincy(state, s.clubId);
  addTimeline(state, { kind: "milestone", title: `Named captain of ${clubName(s.clubId)}`, detail: "Won the race for the armband" });
  addStintEvent(state, "captain");
  addNews(state, { kind: "club", title: "🎗️ You are the new captain", body: `The armband at ${clubName(s.clubId)} is yours.`, important: true });
  p.morale = clamp(p.morale + 8, 0, 100);
  adjustRel(state, "board", 4, "Named club captain");
  end(state, "won the armband");
}

/** The captaincy race as the UI shows it. */
export function raceProgress(state: GameState): { you: number; rivalId: string; weeksLeft: number } | null {
  const s = state.user.drama?.active;
  if (!s || s.kind !== "captaincy" || !s.rivalId) return null;
  const p = userPlayer(state);
  const r = state.players[s.rivalId];
  if (!r) return null;
  return { you: Math.round(clamp(50 + raceLead(state, s, p, r) * 5, 5, 95)), rivalId: r.id, weeksLeft: Math.max(0, s.next - state.turnIndex) };
}
