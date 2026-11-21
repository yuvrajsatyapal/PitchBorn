import { describe, expect, it } from "vitest";
import { careerCaption, careerCardData } from "../src/engine/career/card";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

describe("career card data", () => {
  it("summarises the career with grouped honours", () => {
    const s = newCareer({ seed: "card-1" });
    const p = userPlayer(s);
    p.career.apps = 120;
    p.career.goals = 44;
    p.career.assists = 20;
    p.career.ratingSum = 120 * 7.1;
    s.user.trophies.push(
      { season: 2030, compId: "l", name: "Premier League", kind: "league", clubId: p.clubId ?? undefined },
      { season: 2031, compId: "l", name: "Premier League", kind: "league", clubId: p.clubId ?? undefined },
      { season: 2031, compId: "c", name: "FA Cup", kind: "cup", clubId: p.clubId ?? undefined },
    );
    const d = careerCardData(s);
    expect(d.name).toBe("Alex Tester");
    expect(d.stats.find((x) => x.label === "Goals")?.value).toBe("44");
    expect(d.stats.find((x) => x.label === "Avg rating")?.value).toBe("7.10");
    expect(d.honours[0]).toBe("2× Premier League");
    expect(d.honours).toContain("FA Cup");
    expect(d.clubColors.primary).toMatch(/^#/);
    const text = careerCaption(d, "https://example.test");
    expect(text).toContain("44 goals");
    expect(text).toContain("https://example.test");
  });

  it("shows keepers' numbers and a retired span", () => {
    const s = newCareer({ seed: "card-2", position: "GK" });
    s.user.retired = true;
    s.user.retiredSeason = s.season;
    const d = careerCardData(s);
    expect(d.stats.map((x) => x.label)).toContain("Clean sheets");
    expect(d.retired).toBe(true);
    expect(d.span).not.toContain("present");
  });
});
