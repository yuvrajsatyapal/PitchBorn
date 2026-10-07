import type { Competition, Fixture } from "../types";

export type RunStatus = "alive" | "eliminated" | "won" | "none";

export interface Run {
  status: RunStatus;
  /** "Eliminated in the Quarter-final" */
  text: string;
  stage?: string;
}

const wonTie = (f: Fixture, id: string): boolean => {
  const r = f.result;
  if (!r) return false;
  const mine = f.home === id ? r.hg : r.ag;
  const theirs = f.home === id ? r.ag : r.hg;
  if (mine !== theirs) return mine > theirs;
  if (r.pens) return (f.home === id ? r.pens[0] > r.pens[1] : r.pens[1] > r.pens[0]);
  return false;
};

/** Where a team stands in a competition: still alive, winners, or the round it went out. */
export function teamRun(comp: Competition, id: string): Run {
  if (!comp.teams.includes(id)) return { status: "none", text: "Not in this competition" };
  if (comp.winner === id) return { status: "won", text: "Winners", stage: "Winners" };
  const mine = comp.fixtures.filter((f) => f.home === id || f.away === id).sort((a, b) => a.turn - b.turn);
  const upcoming = mine.find((f) => !f.result);
  const knockout = mine.filter((f) => f.group === undefined);
  const hasGroups = !!comp.groups?.length;
  if (upcoming) return { status: "alive", text: `Still in: next ${upcoming.stage ?? "match"}`, stage: upcoming.stage };
  if (!mine.length) return { status: comp.complete ? "eliminated" : "alive", text: comp.complete ? "Did not play" : "Awaiting the draw" };
  if (comp.runnerUp === id) return { status: "eliminated", text: "Runners-up: lost the final", stage: "Final" };
  const last = knockout[knockout.length - 1];
  if (hasGroups && !last) {
    const groupsDone = comp.fixtures.filter((f) => f.group !== undefined).every((f) => f.result);
    return groupsDone ? { status: "eliminated", text: "Eliminated in the group stage", stage: "Group stage" } : { status: "alive", text: "Still in the group stage", stage: "Group stage" };
  }
  if (!last) return { status: "alive", text: "In progress" };
  if (wonTie(last, id)) {
    // Won the last tie played but nothing further scheduled: waiting for the next round's draw.
    return comp.complete ? { status: "eliminated", text: "Eliminated", stage: last.stage } : { status: "alive", text: `Through the ${last.stage ?? "round"}: next round to come`, stage: last.stage };
  }
  // Two-legged ties: the first leg alone doesn't decide it.
  if (last.leg === 1) return { status: "alive", text: `${last.stage ?? "Tie"} in progress`, stage: last.stage };
  return { status: "eliminated", text: `Eliminated in the ${last.stage ?? "knockout rounds"}`, stage: last.stage };
}
