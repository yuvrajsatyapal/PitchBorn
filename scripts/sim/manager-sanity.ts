/**
 * Manager-history and squad-number sanity check over complete autopilot careers.
 *
 *   npx tsx scripts/sim/manager-sanity.ts [count]
 *
 * Reports manager turnover, tenure, moves, reunions and number integrity. Nothing is tuned to a target: it is for
 * spotting broken patterns (everyone sacked yearly, nobody moving, duplicate managers or numbers, constant reunions).
 */
import { generateAppearance } from "../../src/engine/appearance/generate";
import { autopilotStep, autopilotWantsRetirement } from "../../src/engine/career/autopilot";
import { WORLD } from "../../src/engine/data/world";
import { squadMembers } from "../../src/engine/jersey/numbers";
import { duplicateManagers } from "../../src/engine/managers/registry";
import { Rng } from "../../src/engine/rng";
import { advanceTurn, retireUser } from "../../src/engine/season/advance";
import { POSITIONS } from "../../src/engine/types";
import { createWorld } from "../../src/engine/world/create";
import { userPlayer } from "../../src/engine/world/helpers";

const count = Number(process.argv[2] ?? 6);
const tot = { seasons: 0, clubs: 0, ended: 0, sacked: 0, resigned: 0, moved: 0, retired: 0, tenureYears: 0, multiClub: 0, managers: 0, dupManagers: 0, dupNumbers: 0, missingNumbers: 0, stints: 0, played: 0, reunions: 0, bondOffers: 0, offers: 0, managerMemories: 0, numberChanges: 0, npcRenumbers: 0, userNumberChanges: 0 };
for (let i = 0; i < count; i++) {
  const seed = `mgr-sanity-${i}`;
  const rng = Rng.fromSeed(`career:${seed}`);
  const country = rng.pick(["ENG", "ESP", "GER", "ITA", "FRA"]);
  const clubs = WORLD.clubs.filter((c) => c.countryCode === country && c.leagueId.endsWith(`-${rng.pick([1, 2])}`));
  const s = createWorld({ saveName: "s", firstName: "Sim", lastName: seed, nationality: country, birthCountry: country, position: rng.pick(POSITIONS.filter((p) => p !== "GK")), foot: "R", height: 180, look: generateAppearance("x"), clubId: rng.pick(clubs).id, path: "late", seed, countries: [country] });
  const before = new Map<string, { no: number | undefined; club: string }>();
  let seasons = 0;
  let renumbered = 0;
  const brain = Rng.fromSeed(`brain:${seed}`);
  while (!s.user.retired && seasons < 18) {
    autopilotStep(s, brain);
    if (autopilotWantsRetirement(s)) retireUser(s);
    else advanceTurn(s);
    if (s.turn === 1) {
      seasons++;
      if (duplicateManagers(s).length) tot.dupManagers++;
      for (const c of Object.values(s.clubs)) {
        const nums = squadMembers(s, c.id).map((p) => p.squadNo);
        if (new Set(nums).size !== nums.length) tot.dupNumbers++;
        if (nums.some((n) => n === undefined)) tot.missingNumbers++;
        for (const p of squadMembers(s, c.id)) {
          const was = before.get(p.id);
          if (!p.isUser && was && was.club === c.id && was.no !== p.squadNo) renumbered++;
        }
        for (const p of squadMembers(s, c.id)) before.set(p.id, { no: p.squadNo, club: c.id });
      }
    }
  }
  tot.seasons += seasons;
  tot.clubs += Object.keys(s.clubs).length * seasons;
  const recs = Object.values(s.managers ?? {});
  tot.managers += recs.length;
  for (const r of recs) {
    if (new Set(r.tenures.map((t) => t.clubId)).size > 1) tot.multiClub++;
    for (const t of r.tenures) if (t.to) {
      tot.ended++;
      tot.tenureYears += t.to.season - t.from.season;
      if (t.reason === "sacked") tot.sacked++;
      else if (t.reason === "resigned") tot.resigned++;
      else if (t.reason === "moved") tot.moved++;
      else if (t.reason === "retired") tot.retired++;
    }
  }
  const stints = s.user.mgr?.stints ?? [];
  tot.stints += stints.length;
  tot.played += new Set(stints.filter((x) => x.apps > 0).map((x) => x.managerId)).size;
  tot.reunions += stints.filter((x) => x.reunion).length;
  tot.offers += s.user.offers.length;
  tot.bondOffers += s.user.offers.filter((o) => o.history.some((h) => /former manager/.test(h))).length;
  tot.managerMemories += s.user.memories.filter((m) => m.kind === "manager-bond").length;
  tot.npcRenumbers += renumbered;
  tot.userNumberChanges += Math.max(0, (s.user.jersey?.history.length ?? 1) - new Set((s.user.jersey?.history ?? []).map((t) => t.clubId)).size);
  void userPlayer;
}
const per = (n: number, d: number) => (d ? (n / d).toFixed(3) : "n/a");
console.log(JSON.stringify({
  careers: count,
  seasonsSimulated: tot.seasons,
  managerChangesPerClubSeason: per(tot.ended, tot.clubs),
  avgCompletedTenureYears: per(tot.tenureYears, tot.ended),
  endedBy: { sacked: tot.sacked, resigned: tot.resigned, moved: tot.moved, retired: tot.retired },
  managersWithMoreThanOneClub: `${tot.multiClub} of ${tot.managers}`,
  seasonsWithDuplicateManagers: tot.dupManagers,
  squadSeasonsWithDuplicateNumbers: tot.dupNumbers,
  squadSeasonsWithMissingNumbers: tot.missingNumbers,
  npcRenumberedPerClubSeason: per(tot.npcRenumbers, tot.clubs),
  userStintsPerCareer: per(tot.stints, count),
  managersPlayedUnderPerCareer: per(tot.played, count),
  reunionStints: tot.reunions,
  openOffersCited: `${tot.bondOffers} former-manager of ${tot.offers}`,
  managerMemoriesPerCareer: per(tot.managerMemories, count),
  userClubNumberChangesPerCareer: per(tot.userNumberChanges, count),
}, null, 2));
