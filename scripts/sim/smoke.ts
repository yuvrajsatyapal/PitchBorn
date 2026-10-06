import { createWorld } from "../../src/engine/world/create";
import { advanceTurn } from "../../src/engine/season/advance";
import { overallFor } from "../../src/engine/players/attributes";
const t0 = Date.now();
const s = createWorld({ saveName: "t", firstName: "Test", lastName: "Player", nationality: "ENG", birthCountry: "ENG", position: "ST", foot: "R", height: 182, look: { skin: 0, hair: 0, hairColor: 0, facial: 0, eyes: 0 }, clubId: "eng-ipswich-town", path: "academy", seed: "smoke" });
console.log("create ms", Date.now() - t0, "players", Object.keys(s.players).length, "json MB", (JSON.stringify(s).length / 1e6).toFixed(2));
const seasons = Number(process.argv[2] ?? 1);
for (let i = 0; i < 50 * seasons; i++) {
  const t = Date.now();
  advanceTurn(s);
  const dt = Date.now() - t;
  if (dt > 400) console.log("slow turn", s.season, s.turn, dt);
}
const u = s.players[s.user.playerId];
console.log("total ms", Date.now() - t0, "season", s.season, "turn", s.turn, "players", Object.keys(s.players).length, "MB", (JSON.stringify(s).length / 1e6).toFixed(2));
console.log("user", u.firstName, overallFor(u.attrs, u.position), u.clubId, JSON.stringify(u.history.map(h => [h.season, h.clubId, h.overall, h.stats.apps, h.stats.goals])));
console.log(s.archive.map(a => Object.entries(a.champions).slice(0, 6).map(([k, v]) => `${k}:${v.winner}`).join(" ")).join("\n"));
console.log(s.news.slice(0, 15).map(n => `${n.season}/${n.turn} ${n.title} — ${n.body ?? ""}`).join("\n"));
