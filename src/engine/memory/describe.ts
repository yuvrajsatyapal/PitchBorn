/**
 * Presentation: turns a stored Memory (ids and numbers) into display text.
 * Wording variants are picked from the memory id, so a memory always reads
 * the same but different memories don't all sound alike.
 */
import { clubName } from "../data/world";
import type { GameState, Memory, MemoryKind } from "../types";
import { tierOf } from "./score";

export const MEMORY_ICON: Record<MemoryKind, string> = {
  debut: "🌱", "first-goal": "⚽", "intl-debut": "🌍", "first-intl-goal": "🌍",
  "derby-winner": "🔥", "late-winner": "⏱️", "winner-goal": "⚽", "hat-trick": "🎩", haul: "🎩", comeback: "🔄", "final-goal": "🏟️", "final-winner": "🏆", "famous-upset": "💥",
  trophy: "🏆", "first-title": "🏆", "continental-trophy": "⭐", "intl-trophy": "🌍", record: "📈", award: "🥇",
  "major-injury": "🩹", "injury-comeback": "💪",
  "big-transfer": "✍️", "controversial-transfer": "🌶️", "transfer-rejected": "✋", "return-to-club": "❤️", captaincy: "©️",
  promotion: "⬆️", relegation: "⬇️", "contract-dispute": "📝", "financial-exit": "💸", "manager-conflict": "😤", "career-decision": "🧭",
  retirement: "👋", "final-match": "🔔",
};

export const MEMORY_GROUP: Record<MemoryKind, "Matches" | "Honours" | "Moves" | "Career"> = {
  debut: "Matches", "first-goal": "Matches", "intl-debut": "Matches", "first-intl-goal": "Matches", "derby-winner": "Matches", "late-winner": "Matches", "winner-goal": "Matches",
  "hat-trick": "Matches", haul: "Matches", comeback: "Matches", "final-goal": "Matches", "final-winner": "Matches", "famous-upset": "Matches", "injury-comeback": "Matches", "final-match": "Matches",
  trophy: "Honours", "first-title": "Honours", "continental-trophy": "Honours", "intl-trophy": "Honours", record: "Honours", award: "Honours", promotion: "Honours",
  "big-transfer": "Moves", "controversial-transfer": "Moves", "transfer-rejected": "Moves", "return-to-club": "Moves", "financial-exit": "Moves", "contract-dispute": "Moves",
  "major-injury": "Career", captaincy: "Career", relegation: "Career", "manager-conflict": "Career", "career-decision": "Career", retirement: "Career",
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

  switch (m.kind) {
    case "debut": t = dflt("Professional debut", `Made his debut for ${club}${opp ? ` against ${opp}` : ""}${comp ? ` in the ${comp}` : ""}.`); break;
    case "first-goal": t = dflt("First professional goal", `${pick(m.id, ["Opened his account", "The first of many", "Off the mark"])}${opp ? ` against ${opp}` : ""}${at ? ` on${at}` : ""}.`); break;
    case "intl-debut": t = dflt("International debut", `Won his first cap${opp ? ` against ${opp}` : ""}${comp ? ` (${comp})` : ""}.`); break;
    case "first-intl-goal": t = dflt("First international goal", `Scored for his country${opp ? ` against ${opp}` : ""}${at ? ` on${at}` : ""}.`); break;
    case "derby-winner": t = dflt(`Derby winner${at ? ` —${at}` : ""}`, `${vs}: ${pick(m.id, ["he settled the derby", "the goal that decided the derby", "he won the derby for his side"])}.`); break;
    case "late-winner": t = dflt(`Last-gasp winner${at ? ` —${at}` : ""}`, `${vs}: ${pick(m.id, ["a goal in stoppage time", "the winner at the death", "he snatched it right at the end"])}.`); break;
    case "winner-goal": t = dflt("The winning goal", `${vs}${at ? `, decided on${at}` : ""}.`); break;
    case "hat-trick": t = dflt("Hat-trick", `${vs}: three goals${comp ? ` in the ${comp}` : ""}.`); break;
    case "haul": t = dflt(`${g >= 5 ? "Five-goal" : "Four-goal"} performance`, `${vs}: ${g} goals in one game.`); break;
    case "comeback": t = dflt("Huge comeback", `${vs}, having been ${Number(m.data?.deficit ?? 2)} goals down.`); break;
    case "final-goal": t = dflt("Cup-final goal", `${vs}: scored in the ${comp || "final"}.`); break;
    case "final-winner": t = dflt("Final-winning goal", `${vs}: his goal won the ${comp || "final"}${at ? ` on${at}` : ""}.`); break;
    case "famous-upset": t = dflt("Famous upset", `${vs}: a result nobody saw coming.`); break;
    case "trophy": t = dflt(`${comp || "Trophy"} winner`, `Lifted the ${comp || "trophy"}${club ? ` with ${club}` : ""}.`); break;
    case "first-title": t = dflt("First league title", `Won the ${comp || "league"} with ${club}.`); break;
    case "continental-trophy": t = dflt(`${comp || "Continental"} champion`, `Won the ${comp || "continental trophy"}${club ? ` with ${club}` : ""}.`); break;
    case "intl-trophy": t = dflt("International champion", `Won the ${comp || "tournament"} for his country.`); break;
    case "record": t = dflt("Record broken", `${String(m.data?.label ?? "A record")} — ${String(m.data?.value ?? "")}.`); break;
    case "award": t = dflt(String(m.data?.name ?? "Individual award"), `${String(m.data?.scope ?? "")}.`.replace(/^\.$/, "A major individual honour.")); break;
    case "major-injury": t = dflt("Major injury", `${String(m.data?.type ?? "An injury")} — out for ${Number(m.data?.weeks ?? 0)} weeks.`); break;
    case "injury-comeback": t = dflt("The comeback", `Back after ${Number(m.data?.weeks ?? 0)} weeks out${opp ? `, against ${opp}` : ""}${Number(m.data?.goals ?? 0) > 0 ? " — and he scored" : ""}.`); break;
    case "big-transfer": t = dflt("Big move", `Joined ${name(m.transfer?.to ?? m.clubId)}${m.transfer?.from ? ` from ${name(m.transfer.from)}` : ""}.`); break;
    case "controversial-transfer": t = dflt("A controversial move", `Left ${name(m.transfer?.from)} for ${name(m.transfer?.to)}. Not everyone forgave him.`); break;
    case "transfer-rejected": t = dflt("Said no to a bigger club", `Turned down ${name(m.opponentId)} to stay put.`); break;
    case "return-to-club": t = dflt("Coming home", `Returned to ${name(m.clubId)} after ${Number(m.data?.years ?? 0)} years away.`); break;
    case "captaincy": t = dflt("Handed the armband", `Named captain of ${club}.`); break;
    case "promotion": t = dflt("Promotion", `Went up with ${club}.`); break;
    case "relegation": t = dflt("Relegation", `Went down with ${club}.`); break;
    case "contract-dispute": t = dflt("Contract dispute", `Talks with ${club || "the club"} broke down.`); break;
    case "financial-exit": t = dflt("Left a club in crisis", `Moved on from ${name(m.clubId)} as the money ran out.`); break;
    case "manager-conflict": t = dflt("Falling out", `A bitter rift with the manager at ${club}.`); break;
    case "career-decision": t = dflt("A defining decision", String(m.data?.title ?? "A choice that shaped a career")); break;
    case "retirement": t = dflt("Retirement", `Hung up his boots after ${Number(m.data?.apps ?? 0)} appearances and ${Number(m.data?.goals ?? 0)} goals.`); break;
    case "final-match": t = dflt("The final match", `${vs || "His last game"}${Number(m.data?.goals ?? 0) > 0 ? `, with ${Number(m.data?.goals)} goal${Number(m.data?.goals) > 1 ? "s" : ""}` : ""}.`); break;
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
