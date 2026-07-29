import { describe, expect, it } from "vitest";

import { sortLeaguesByRecentVisit } from "./sort-leagues-by-recent-visit";

describe("sortLeaguesByRecentVisit", () => {
  const t1 = new Date("2026-07-01T12:00:00.000Z");
  const t2 = new Date("2026-07-15T12:00:00.000Z");
  const t3 = new Date("2026-07-20T12:00:00.000Z");

  it("sorts visited leagues before never-visited", () => {
    const rows = sortLeaguesByRecentVisit([
      { league: { name: "Alpha" }, lastVisitedAt: null },
      { league: { name: "Beta" }, lastVisitedAt: t2 },
    ]);
    expect(rows.map((r) => r.league.name)).toEqual(["Beta", "Alpha"]);
  });

  it("sorts newer visits before older visits", () => {
    const rows = sortLeaguesByRecentVisit([
      { league: { name: "Old" }, lastVisitedAt: t1 },
      { league: { name: "New" }, lastVisitedAt: t3 },
      { league: { name: "Mid" }, lastVisitedAt: t2 },
    ]);
    expect(rows.map((r) => r.league.name)).toEqual(["New", "Mid", "Old"]);
  });

  it("uses name ascending as tiebreak when visit times match or both null", () => {
    const rows = sortLeaguesByRecentVisit([
      { league: { name: "Zulu" }, lastVisitedAt: null },
      { league: { name: "Alpha" }, lastVisitedAt: null },
      { league: { name: "Mike" }, lastVisitedAt: t2 },
      { league: { name: "Echo" }, lastVisitedAt: t2 },
    ]);
    expect(rows.map((r) => r.league.name)).toEqual(["Echo", "Mike", "Alpha", "Zulu"]);
  });

  it("does not mutate the input array", () => {
    const input = [{ league: { name: "A" }, lastVisitedAt: null }];
    const copy = [...input];
    sortLeaguesByRecentVisit(input);
    expect(input).toEqual(copy);
  });
});
