/**
 * Presentation: turns a stored Memory (ids and numbers) into display text.
 * Wording variants are picked from the memory id, so a memory always reads
 * the same but different memories don't all sound alike.
 */
import { clubName } from "../data/world";
import type { GameState, Memory, MemoryKind } from "../types";
import { traitDef } from "../traits/registry";
import { tierOf } from "./score";

export const MEMORY_ICON: Record<MemoryKind, string> = {
  debut: "🌱", "first-goal": "⚽", "intl-debut": "🌍", "first-intl-goal": "🌍",
  "derby-winner": "🔥", "late-winner": "⏱️", "winner-goal": "⚽", "hat-trick": "🎩", haul: "🎩", comeback: "🔄", "final-goal": "🏟️", "final-winner": "🏆", "famous-upset": "💥",
  trophy: "🏆", "first-title": "🏆", "continental-trophy": "⭐", "intl-trophy": "🌍", record: "📈", award: "🥇",
  "major-injury": "🩹", "injury-comeback": "💪",
  "big-transfer": "✍️", "controversial-transfer": "🌶️", "transfer-rejected": "✋", "return-to-club": "❤️", captaincy: "©️",
  promotion: "⬆️", relegation: "⬇️", "contract-dispute": "📝", "financial-exit": "💸", "manager-conflict": "😤", "career-decision": "🧭",
  retirement: "👋", "final-match": "🔔", identity: "🧬", "transfer-saga": "📰", rivalry: "⚔️", "manager-bond": "🤝", "shirt-number": "👕",
};

export const MEMORY_GROUP: Record<MemoryKind, "Matches" | "Honours" | "Moves" | "Career"> = {
  debut: "Matches", "first-goal": "Matches", "intl-debut": "Matches", "first-intl-goal": "Matches", "derby-winner": "Matches", "late-winner": "Matches", "winner-goal": "Matches",
  "hat-trick": "Matches", haul: "Matches", comeback: "Matches", "final-goal": "Matches", "final-winner": "Matches", "famous-upset": "Matches", "injury-comeback": "Matches", "final-match": "Matches",
  trophy: "Honours", "first-title": "Honours", "continental-trophy": "Honours", "intl-trophy": "Honours", record: "Honours", award: "Honours", promotion: "Honours",
  "big-transfer": "Moves", "controversial-transfer": "Moves", "transfer-rejected": "Moves", "return-to-club": "Moves", "financial-exit": "Moves", "contract-dispute": "Moves", "transfer-saga": "Moves", rivalry: "Career",
  "major-injury": "Career", "manager-bond": "Career", "shirt-number": "Career", identity: "Career", captaincy: "Career", relegation: "Career", "manager-conflict": "Career", "career-decision": "Career", retirement: "Career",
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = <T,>(id: string, xs: T[]): T => xs[hash(id) % xs.length];

export function minuteText(m: Memory): string {
  const min = m.minute;
  if (min === undefined) return "";
  if (m.data?.et) return `${min}'`;
  return min > 90 ? `90+${min - 90}'` : `${min}'`;
}

function scoreText(m: Memory): string {
  return m.score ? `${m.score[0]}–${m.score[1]}` : "";
}

const name = (id?: string | null) => (id ? clubName(id, true) : "");
const verb = (m: Memory) => (m.outcome === "win" ? "win over" : m.outcome === "loss" ? "defeat to" : "draw with");

export interface MemoryView {
  icon: string;
  title: string;
  /** One-line summary for lists and recall. */
  line: string;
  /** Extra lines for the detail card (context, how it scored). */
  details: string[];
  tier: ReturnType<typeof tierOf>;
  /** "Age 19" style label. */
  ageLabel: string;
  seasonLabel: string;
}

export function describeMemory(state: GameState, m: Memory): MemoryView {
  const opp = name(m.opponentId);
  const club = name(m.clubId);
  const at = m.minute !== undefined ? ` ${minuteText(m)}` : "";
  const comp = m.compName ?? "";
  const sc = scoreText(m);
  const g = Number(m.data?.goals ?? 0);
  const vs = opp ? `${sc ? `${sc} ${verb(m)} ${opp}` : `against ${opp}`}` : sc;
  const dflt = (title: string, line: string) => ({ title, line });
  let t: { title: string; line: string };

  const games = (n: number) => `${n} goal${n === 1 ? "" : "s"}`;
  switch (m.kind) {
    case "debut": t = dflt("Professional debut", `You made your debut for ${club}${opp ? ` against ${opp}` : ""}${comp ? ` in the ${comp}` : ""}.`); break;
    case "first-goal": t = dflt("First professional goal", `${pick(m.id, ["You opened your account", "The first of many", "You were off the mark"])}${opp ? ` against ${opp}` : ""}${at ? ` on${at}` : ""}.`); break;
    case "intl-debut": t = dflt("International debut", `You won your first cap${opp ? ` against ${opp}` : ""}${comp ? ` (${comp})` : ""}.`); break;
    case "first-intl-goal": t = dflt("First international goal", `You scored for your country${opp ? ` against ${opp}` : ""}${at ? ` on${at}` : ""}.`); break;
    case "derby-winner": t = dflt(`Derby winner${at ? ` —${at}` : ""}`, `${vs}: ${pick(m.id, ["you settled the derby", "the goal that decided the derby was yours", "you won the derby for your side"])}.`); break;
    case "late-winner": t = dflt(`Last-gasp winner${at ? ` —${at}` : ""}`, `${vs}: ${pick(m.id, ["a goal in stoppage time", "the winner at the death", "you snatched it right at the end"])}.`); break;
    case "winner-goal": t = dflt("The winning goal", `${vs}${at ? `, decided on${at}` : ""}.`); break;
    case "hat-trick": t = dflt("Hat-trick", `${vs}: you scored three${comp ? ` in the ${comp}` : ""}.`); break;
    case "haul": t = dflt(`${g >= 5 ? "Five-goal" : "Four-goal"} performance`, `${vs}: ${games(g)} in one game.`); break;
    case "comeback": t = dflt("Huge comeback", `${vs}, after being ${Number(m.data?.deficit ?? 2)} goals down.`); break;
    case "final-goal": t = dflt("Cup-final goal", `${vs}: you scored in the ${comp || "final"}.`); break;
    case "final-winner": t = dflt("Final-winning goal", `${vs}: your goal won the ${comp || "final"}${at ? ` on${at}` : ""}.`); break;
    case "famous-upset": t = dflt("Famous upset", `${vs}: a result nobody saw coming.`); break;
    case "trophy": t = dflt(`${comp || "Trophy"} winner`, `You lifted the ${comp || "trophy"}${club ? ` with ${club}` : ""}.`); break;
    case "first-title": t = dflt("First league title", `You won the ${comp || "league"} with ${club}.`); break;
    case "continental-trophy": t = dflt(`${comp || "Continental"} champion`, `You won the ${comp || "continental trophy"}${club ? ` with ${club}` : ""}.`); break;
    case "intl-trophy": t = dflt("International champion", `You won the ${comp || "tournament"} for your country.`); break;
    case "record": t = dflt("Record broken", `${String(m.data?.label ?? "A record")} — ${String(m.data?.value ?? "")}.`); break;
    case "award": t = dflt(String(m.data?.name ?? "Individual award"), `${String(m.data?.scope ?? "")}.`.replace(/^\.$/, "A major individual honour.")); break;
    case "major-injury": t = dflt("Major injury", `${String(m.data?.type ?? "An injury")} — you were out for ${Number(m.data?.weeks ?? 0)} weeks.`); break;
    case "injury-comeback": t = dflt("The comeback", `You came back after ${Number(m.data?.weeks ?? 0)} weeks out${opp ? `, against ${opp}` : ""}${Number(m.data?.goals ?? 0) > 0 ? " — and you scored" : ""}.`); break;
    case "big-transfer": t = dflt("Big move", `You joined ${name(m.transfer?.to ?? m.clubId)}${m.transfer?.from ? ` from ${name(m.transfer.from)}` : ""}.`); break;
    case "controversial-transfer": t = dflt("A controversial move", `You left ${name(m.transfer?.from)} for ${name(m.transfer?.to)}. Not everyone forgave you.`); break;
    case "rivalry": {
      const rivalName = String(m.data?.name ?? "your rival");
      const event = String(m.data?.event ?? "duel");
      if (event === "formed") t = dflt(`A rivalry begins with ${rivalName}`, `Something about ${rivalName} got under your skin, and the feeling was mutual.`);
      else if (event === "award") t = dflt(m.data?.won ? `You beat ${rivalName} to the ${m.data?.award}` : `${rivalName} took the ${m.data?.award}`, m.data?.won ? "A season-long duel settled in your favour." : "A season-long duel that went the other way.");
      else t = dflt(`Duel with ${rivalName}`, `${vs || "A big meeting"}: ${m.outcome === "win" ? "you came out on top" : m.outcome === "loss" ? "they had the better of it" : "neither gave an inch"}.`);
      break;
    }
    case "transfer-saga": {
      const outcome = String(m.data?.outcome ?? "completed");
      const bids = Number(m.data?.bids ?? 0);
      const bidText = bids > 1 ? ` after ${bids} bids` : "";
      const to = name(m.transfer?.to ?? m.clubId);
      if (outcome === "completed") t = dflt(m.data?.returning ? `The long road back to ${to}` : `The ${to} saga`, `${pick(m.id, ["It took", "It ran", "It finally came together"])} ${Number(m.data?.weeks ?? 0)} weeks${bidText}, and you joined ${to}.`);
      else if (outcome === "player-declined") t = dflt(`You turned ${to} down`, `After a long, public chase you chose to stay${m.data?.loyal ? " out of loyalty" : ""}.`);
      else t = dflt(`The move to ${to} that never happened`, `${bids ? `${bids} bid${bids === 1 ? "" : "s"} and weeks of talks` : "Weeks of talks"}, but the deal fell through.`);
      break;
    }
    case "transfer-rejected": t = dflt("Said no to a bigger club", `You turned down ${name(m.opponentId)} and stayed put.`); break;
    case "return-to-club": t = dflt("Coming home", `You returned to ${name(m.clubId)} after ${Number(m.data?.years ?? 0)} years away.`); break;
    case "captaincy": t = dflt("Handed the armband", `You were named captain of ${club}.`); break;
    case "promotion": t = dflt("Promotion", `You went up with ${club}.`); break;
    case "relegation": t = dflt("Relegation", `You went down with ${club}.`); break;
    case "contract-dispute": t = dflt("Contract dispute", `Talks with ${club || "the club"} broke down.`); break;
    case "financial-exit": t = dflt("Left a club in crisis", `You moved on from ${name(m.clubId)} as the money ran out.`); break;
    case "manager-conflict": t = dflt("Falling out", `A bitter rift with the manager at ${club}.`); break;
    case "career-decision": t = dflt("A defining decision", String(m.data?.title ?? "A choice that shaped your career")); break;
    case "identity": {
      const def = traitDef(String(m.data?.trait ?? ""));
      const from = traitDef(String(m.data?.from ?? ""));
      t = m.data?.event === "evolved"
        ? dflt("Reinvented", `Your game evolved${from ? `: ${from.name} gave way to ${def?.name ?? "a new style"}` : ` into ${def?.name ?? "a new style"}`}.`)
        : dflt(`Signature ${def?.name ?? "style"}`, `${pick(m.id, ["Your game became defined by", "Defenders learned to fear", "You made your own"])} ${def?.name ?? "a style"}.`);
      break;
    }
    case "manager-bond": {
      const who = String(m.data?.name ?? "the manager");
      const ev = String(m.data?.event ?? "");
      if (ev === "breakthrough") t = dflt(`Breakthrough under ${who}`, `${who} gave you your first-team chance${club ? ` at ${club}` : ""}.`);
      else if (ev === "captain") t = dflt(`The armband from ${who}`, `${who} made you captain${club ? ` of ${club}` : ""}.`);
      else if (ev === "departure") t = dflt(`${who} leaves`, `${who} left${club ? ` ${club}` : ""} after ${Number(m.data?.seasons ?? 0)} season${Number(m.data?.seasons ?? 0) === 1 ? "" : "s"} together.`);
      else if (ev === "reunion-match") t = dflt(`Facing ${who}`, `${vs ? `${vs}: ` : ""}your first meeting with the manager you played under${m.data?.where ? ` at ${String(m.data.where)}` : ""}.`);
      else if (ev === "reunited") t = dflt(`Reunited with ${who}`, `You joined ${club || "a new club"} to work with ${who} again.`);
      else t = dflt(`With ${who}`, "A bond that shaped your career.");
      break;
    }
    case "shirt-number": {
      const no = Number(m.data?.no ?? 0);
      const ev = String(m.data?.event ?? "");
      t = ev === "return" ? dflt(`Back in the #${no} shirt`, `You pulled on #${no} again${club ? ` at ${club}` : ""}.`) : dflt(`The #${no} shirt`, `You took the #${no} shirt${club ? ` at ${club}` : ""}${ev === "iconic" ? ", the number that goes with a star" : ""}.`);
      break;
    }
    case "retirement": t = dflt("Retirement", `You hung up your boots after ${Number(m.data?.apps ?? 0)} appearances and ${Number(m.data?.goals ?? 0)} goals.`); break;
    case "final-match": t = dflt("The final match", `${vs || "Your last game"}${Number(m.data?.goals ?? 0) > 0 ? `, with ${games(Number(m.data?.goals))} of your own` : ""}.`); break;
    default: t = dflt("A memory", "");
  }

  const details: string[] = [];
  if (comp && m.stage) details.push(`${comp} · ${m.stage}`);
  else if (comp) details.push(comp);
  if (m.tags.includes("derby") && m.rivalId) details.push(`Rivalry with ${name(m.rivalId)}`);
  if (m.tags.includes("brace") || (g >= 2 && m.kind !== "hat-trick" && m.kind !== "haul")) details.push(`${g} goals in the game`);
  const season = `${m.season}/${String((m.season + 1) % 100).padStart(2, "0")}`;
  return { icon: MEMORY_ICON[m.kind], title: t.title, line: t.line, details, tier: tierOf(m.importance), ageLabel: `Age ${m.age}`, seasonLabel: season };
}
