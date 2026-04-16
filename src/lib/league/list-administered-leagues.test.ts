import { describe, expect, it } from "vitest";

import { toAdministeredLeagueRows } from "./list-administered-leagues";

describe("toAdministeredLeagueRows", () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");

  it("maps missing season slice to null", () => {
    const rows = toAdministeredLeagueRows([
      {
        id: "league-a",
        name: "Alpha",
        createdAt,
        seasons: [],
      },
    ]);
    expect(rows).toEqual([
      {
        league: { id: "league-a", name: "Alpha", createdAt },
        season: null,
      },
    ]);
  });

  it("uses the first season when the query returns one row", () => {
    const updatedAt = new Date("2026-04-01T12:00:00.000Z");
    const rows = toAdministeredLeagueRows([
      {
        id: "league-b",
        name: "Beta",
        createdAt,
        seasons: [
          {
            id: "season-1",
            nflSeasonYear: 2026,
            firstCompetitionWeek: 2,
            preSeasonInitializedAt: null,
            updatedAt,
          },
        ],
      },
    ]);
    expect(rows[0]?.season).toEqual({
      id: "season-1",
      nflSeasonYear: 2026,
      firstCompetitionWeek: 2,
      preSeasonInitializedAt: null,
      updatedAt,
    });
  });

  it("is stable for deterministic sort when leagues are already ordered by name", () => {
    const rows = toAdministeredLeagueRows([
      {
        id: "1",
        name: "A",
        createdAt,
        seasons: [],
      },
      {
        id: "2",
        name: "B",
        createdAt,
        seasons: [],
      },
    ]);
    expect(rows.map((r) => r.league.name)).toEqual(["A", "B"]);
  });
});
