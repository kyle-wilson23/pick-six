import { describe, expect, it } from "vitest";

import { mapCurrentPick, mapSeasonPickedTeams } from "./map-current-pick";

describe("mapCurrentPick", () => {
  it("returns null for null input (no saved pick yet)", () => {
    expect(mapCurrentPick(null)).toBeNull();
  });

  it("maps a present row to camelCase JSON with ISO updatedAt", () => {
    const updatedAt = new Date("2026-09-10T11:30:00.000Z");
    expect(
      mapCurrentPick({ teamId: "team-buf", antiJailedBonus: true, updatedAt }),
    ).toEqual({
      teamId: "team-buf",
      antiJailedBonus: true,
      updatedAt: "2026-09-10T11:30:00.000Z",
    });
  });

  it("preserves antiJailedBonus = false (default 1-pt pick)", () => {
    const result = mapCurrentPick({
      teamId: "team-pit",
      antiJailedBonus: false,
      updatedAt: new Date("2026-09-10T00:00:00.000Z"),
    });
    expect(result?.antiJailedBonus).toBe(false);
  });
});

describe("mapSeasonPickedTeams", () => {
  it("returns empty array for empty input (no other-week picks yet)", () => {
    expect(mapSeasonPickedTeams([])).toEqual([]);
  });

  it("maps nflWeekNumber → weekNumber per camelCase JSON convention", () => {
    expect(
      mapSeasonPickedTeams([
        { teamId: "team-kc", nflWeekNumber: 1 },
        { teamId: "team-sf", nflWeekNumber: 3 },
      ]),
    ).toEqual([
      { teamId: "team-kc", weekNumber: 1 },
      { teamId: "team-sf", weekNumber: 3 },
    ]);
  });

  it("preserves caller-provided ordering (no implicit sort)", () => {
    const rows = [
      { teamId: "z", nflWeekNumber: 5 },
      { teamId: "a", nflWeekNumber: 2 },
    ];
    expect(mapSeasonPickedTeams(rows).map((r) => r.teamId)).toEqual(["z", "a"]);
  });
});
