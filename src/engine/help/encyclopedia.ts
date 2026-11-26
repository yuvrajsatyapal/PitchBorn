/**
 * The in-game encyclopedia: every attribute, trait and system explained in a sentence or two, searchable. Attribute
 * and trait entries come straight from the model tables so they can never drift from the code; the system entries are
 * written here and kept short.
 */
import { ATTR } from "../players/model";
import { TRAITS } from "../traits/registry";
import { WEATHER_ICON, WEATHER_LABEL } from "../weather/describe";
import type { AttrKey, WeatherKind } from "../types";

export type HelpSection = "Basics" | "Attributes" | "Traits" | "Match" | "Weather" | "Career" | "Money" | "Clubs & world" | "After football";

export interface HelpEntry {
  id: string;
  section: HelpSection;
  title: string;
  body: string;
  /** Extra words that should find this entry. */
  tags?: string[];
  link?: { href: string; label: string };
}

const MEANING: Record<AttrKey, string> = {
  pace: "Sustained top speed: runs in behind and recovering over distance.",
  acceleration: "First steps and short bursts: reaching a loose ball, closing down, breaking from a standing start.",
  agility: "Turning and changing direction: beating a man, staying with a winger.",
  stamina: "How long you last. Match fatigue and recovery between games.",
  strength: "Winning physical contests, shielding the ball, holding off a challenge.",
  balance: "Staying on your feet under contact and keeping the ball when pressed.",
  jumping: "Reach in the air: who gets to a cross first.",
  passing: "Pass execution: weight, accuracy and range.",
  firstTouch: "Receiving: killing a pass and turning in one movement.",
  technique: "Difficult execution: curling, dipping, volleys and awkward deliveries.",
  dribbling: "Carrying the ball past an opponent.",
  crossing: "Wide delivery into the box.",
  tackling: "Winning the ball by challenging for it.",
  finishing: "Converting chances inside the area.",
  longShots: "Shooting from distance and direct free kicks.",
  heading: "Attacking and clearing headers once you get there.",
  offBall: "The run, the late arrival, finding space between defenders.",
  creativity: "The unusual pass or move nobody sees coming.",
  positioning: "Defensive shape: where to stand, blocking shots, covering the zone.",
  marking: "Tracking a man and staying with a runner.",
  interceptions: "Cutting out a pass without making contact.",
  composure: "Execution under pressure: the finish with the keeper out, the pass with a man closing.",
  vision: "Noticing the options that are on.",
  decisions: "Choosing the right action: when to shoot, pass, or not foul.",
  anticipation: "Reading what happens next: the second ball, the counter.",
  workRate: "How much ground you choose to cover: pressing and tracking back.",
  aggression: "Willingness to challenge, and the booking risk that comes with it.",
  reflexes: "Goalkeeping: reaction saves.",
  diving: "Goalkeeping: reach when diving.",
  handling: "Goalkeeping: holding on to shots and crosses.",
  command: "Goalkeeping: claiming crosses and coming off the line.",
  kicking: "Goalkeeping: distribution.",
  oneOnOnes: "Goalkeeping: closing down and winning a one-on-one.",
};

const AGEING: Record<string, string> = {
  explosive: "Explosive: fades from about 32.",
  athletic: "Athletic: takes the full decline with age.",
  skill: "Skill: ages gently.",
  mind: "Mind: barely ages, and often improves.",
};

const SYSTEMS: HelpEntry[] = [
  { id: "continue", section: "Basics", title: "Continue and skipping weeks", body: "Continue moves the calendar on one week and stops whenever something needs you: a match, a decision, an offer. » skips several weeks at once.", tags: ["advance", "sim", "week"] },
  { id: "overall", section: "Basics", title: "Overall and potential", body: "Overall is a weighted blend of the attributes that matter for your position. Potential is hidden: scouts and coaches give hints, and good training, minutes and professionalism get you closer to it.", tags: ["ovr", "rating"] },
  { id: "training", section: "Basics", title: "Training", body: "Each week's focus decides which attributes grow. Intense weeks grow you faster but raise injury risk if you string too many together.", link: { href: "/play/training", label: "Training" } },
  { id: "tips", section: "Basics", title: "Tips and the tutorial", body: "First-season tips appear on each screen while they are relevant. Replay the tutorial from Settings to see them all again this season.", tags: ["tutorial", "help"], link: { href: "/play/settings", label: "Settings" } },
  { id: "difficulty", section: "Basics", title: "Difficulty", body: "Affects manager trust and contract generosity. Potential is fixed when the career starts." },
  { id: "moments", section: "Match", title: "Key moments", body: "In a live match you choose what to do when the ball comes to you: shoot, pass, dribble, cross, tackle and more. The odds shown follow your attributes, your traits, your fitness and the weather. Risky options pay off big when they come off.", tags: ["decision", "live", "shoot", "pass", "dribble"] },
  { id: "rating", section: "Match", title: "Match rating", body: "Starts at 6.0 and moves with every action: goals, assists, key passes, tackles, mistakes. Ratings feed form, which the manager uses to pick the team." },
  { id: "setpieces", section: "Match", title: "Set-piece duties", body: "Ask the manager to take penalties or free kicks. He weighs your standing and your relationship. Two misses in your last three penalties and he may take the duty away.", tags: ["penalty", "free kick"] },
  { id: "roles", section: "Match", title: "Tactical roles", body: "Agree a role with the manager, such as inverted full-back, false nine or box-to-box. The role changes where your involvement comes from, how ratings judge you, and how often you are picked when the role suits the team.", tags: ["role", "tactics", "false nine", "inverted"], link: { href: "/play/club", label: "Club & Squad" } },
  { id: "chemistry", section: "Match", title: "Teammate chemistry", body: "Playing alongside teammates builds bonds that slightly improve link-up on the pitch. Cliques form in the dressing room and pull bonds apart if you pick a side." },
  { id: "subs", section: "Match", title: "Substitutions", body: "Managers make up to five changes in three windows. Tired, booked or poorly rated players come off first." },
  { id: "contracts", section: "Career", title: "Contracts and squad role", body: "Your contract names a squad role (star, first team, rotation, backup, prospect). The role sets how often you should play; if you get far fewer minutes, ask for a transfer or a loan.", tags: ["wage", "renewal"], link: { href: "/play/transfers", label: "Career & Contract" } },
  { id: "transfers", section: "Career", title: "Transfers, bidding wars and deadline day", body: "Clubs bid for you during the windows. A second club can join and push the fee and wage up. On deadline day late bids arrive and must be answered within the day. Your agent can leak interest to force a better offer from your club, at the cost of some goodwill with the manager.", tags: ["bid", "deadline", "leak", "window"] },
  { id: "agents", section: "Career", title: "Agents", body: "Agents have a style: greedy ones squeeze clubs and take more commission, loyal ones stand by you, connected ones open doors to bigger clubs. You can fire an agent, but it costs severance." },
  { id: "drama", section: "Career", title: "Off-pitch drama", body: "Contract stand-offs can go public, dressing rooms split into cliques, a manager can fall out with you, and the captaincy can become a race. Each story asks for decisions and moves your relationships.", tags: ["captain", "clique", "fall out", "stand-off"] },
  { id: "injuries", section: "Career", title: "Injuries and recovery", body: "For bigger injuries you choose: rush back, follow the plan or rest fully, and sometimes surgery or not. A specialist clinic paid from your bank shortens recovery. Repeat injuries to the same area make the next one likelier and, late in a career, can end it.", tags: ["surgery", "clinic", "rehab", "recurring"] },
  { id: "youth", section: "Career", title: "Starting as a youth player", body: "Start at 15 in an academy. You play youth-league games, can go on trial at other clubs, and at 17 decide where to sign your first professional contract.", tags: ["academy", "trial", "scholarship", "15"] },
  { id: "national", section: "Career", title: "National team", body: "Good form and reputation earn call-ups. If you are eligible for more than one nation, others may invite you; once capped in a competitive game, the choice is final.", tags: ["international", "caps"] },
  { id: "press", section: "Career", title: "Press conferences and the feed", body: "Answer questions before or after matches. Your tone moves morale, fans and the manager. The social feed reacts to your games." },
  { id: "goals", section: "Career", title: "Weekly goals and cosmetics", body: "Three small goals each in-game week, like scoring in three straight games. Completing them unlocks boots, kit colours and goal celebrations for your player.", tags: ["boots", "celebration", "reward", "objective"], link: { href: "/play/goals", label: "Goals & Kit Room" } },
  { id: "sponsors", section: "Money", title: "Sponsors", body: "Deals pay a yearly value and carry a season target; hit it for a bonus of a quarter of the value. Bigger brands add a form clause and drop you if your ratings fall away.", tags: ["sponsor", "deal", "bonus"] },
  { id: "lifestyle", section: "Money", title: "Lifestyle", body: "Homes, cars, staff, charity and investments. Prices follow your wage. Each has small effects such as better rest or a better reputation, and weekly upkeep. Investments can grow or fall.", tags: ["house", "car", "investment", "charity"], link: { href: "/play/lifestyle", label: "Lifestyle & Money" } },
  { id: "leagues", section: "Clubs & world", title: "Countries and leagues", body: "Eleven countries: England, Spain, Germany, Italy and France with three tiers; Portugal, the Netherlands, Brazil, Argentina, Mexico and the United States with two. MLS and Liga MX are closed leagues with no promotion or relegation. Choose a smaller world at the start for faster weeks.", tags: ["country", "league", "world", "mls", "brazil"] },
  { id: "continental", section: "Clubs & world", title: "Continental cups", body: "European clubs play the Champions Cup and the Continental Cup; the best of Brazil, Argentina, Mexico and the US play the Americas Cup. Places come from last season's league finish.", tags: ["champions cup", "americas cup"] },
  { id: "womens", section: "Clubs & world", title: "Women's football", body: "Pick the women's world when starting a career: real women's clubs and leagues, generated players, the same match engine and career systems.", tags: ["women", "wsl", "nwsl"] },
  { id: "managed", section: "After football", title: "Managing a club", body: "After retiring you can coach: youth coach, assistant, then manager. A manager has a transfer budget and a wage cap, an academy that produces prospects each spring, and board objectives. Fall too far behind them and the board sacks you.", tags: ["coach", "manager", "budget", "board", "sacked"], link: { href: "/play/coach", label: "Coaching" } },
  { id: "generations", section: "After football", title: "The next generation", body: "After retiring, start your child's career in the same world. They inherit some of your traits and looks, and you can be their agent or, if you manage a club, their coach.", tags: ["child", "son", "daughter", "family", "legacy"] },
  { id: "hof", section: "After football", title: "Hall of Fame", body: "Every retired career from every save. Compare two careers side by side, see all-time records and pick your greatest XI.", tags: ["compare", "greatest xi", "records"], link: { href: "/hall-of-fame", label: "Hall of Fame" } },
  { id: "challenges", section: "After football", title: "Challenges and share codes", body: "Pick a challenge scenario when starting. The weekly challenge uses the same world for everyone that week; finish it and copy your share code (PB-W47-…) to compare with friends, no server needed.", tags: ["weekly", "seed", "share", "code", "leaderboard"] },
];

const WEATHER_TEXT: Record<WeatherKind, string> = {
  clear: "Baseline football: nothing changes.",
  rain: "The ball skids: first touches and passing are a little harder.",
  "heavy-rain": "A slick, heavy surface: control suffers most; strong, balanced players cope best.",
  snow: "The ball holds up and the game slows down; footing is unreliable.",
  heat: "Legs go early: stamina matters more and late-game quality drops.",
  wind: "Crosses, long shots and goal kicks are hard to judge.",
};

export function encyclopedia(): HelpEntry[] {
  const attrs: HelpEntry[] = (Object.keys(ATTR) as AttrKey[]).map((k) => ({
    id: `attr-${k}`,
    section: "Attributes",
    title: ATTR[k].label,
    body: `${MEANING[k]} ${AGEING[ATTR[k].ageing] ?? ""}`.trim(),
    tags: [ATTR[k].group],
  }));
  const traits: HelpEntry[] = TRAITS.map((t) => ({
    id: `trait-${t.id}`,
    section: "Traits",
    title: t.name,
    body: t.blurb,
    tags: [t.category, ...(t.flaw ? ["flaw"] : []), ...t.positions],
  }));
  const weather: HelpEntry[] = (Object.keys(WEATHER_LABEL) as WeatherKind[]).map((w) => ({
    id: `wx-${w}`,
    section: "Weather",
    title: `${WEATHER_ICON[w]} ${WEATHER_LABEL[w]}`,
    body: WEATHER_TEXT[w],
    tags: ["weather", "pitch"],
  }));
  weather.push({ id: "wx-roof", section: "Weather", title: "🏟️ Roofs and postponements", body: "Stadiums with a retractable roof close it in bad weather, so conditions inside are perfect. A frozen pitch can postpone a match to a later week.", tags: ["frozen", "postponed"] });
  return [...SYSTEMS, ...attrs, ...traits, ...weather];
}

export const HELP_SECTIONS: HelpSection[] = ["Basics", "Match", "Career", "Money", "Clubs & world", "After football", "Attributes", "Traits", "Weather"];

/** Every word of the query must appear in the title, body or tags. Title matches rank first. */
export function searchHelp(entries: HelpEntry[], query: string, section?: HelpSection | "All"): HelpEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const pool = section && section !== "All" ? entries.filter((e) => e.section === section) : entries;
  if (!words.length) return pool;
  const scored = pool
    .map((e) => {
      const title = e.title.toLowerCase();
      const hay = `${title} ${e.body.toLowerCase()} ${(e.tags ?? []).join(" ").toLowerCase()}`;
      if (!words.every((w) => hay.includes(w))) return null;
      return { e, score: words.filter((w) => title.includes(w)).length };
    })
    .filter((x): x is { e: HelpEntry; score: number } => x !== null);
  return scored.sort((a, b) => b.score - a.score).map((x) => x.e);
}
