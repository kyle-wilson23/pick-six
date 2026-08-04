import { describe, expect, it } from "vitest";

import { mapOddsScoresToResultUpdates } from "./map-results-from-scores";

const TEAMS = [
  { id: "phi", abbreviation: "PHI", name: "Philadelphia Eagles" },
  { id: "dal", abbreviation: "DAL", name: "Dallas Cowboys" },
];

describe("mapOddsScoresToResultUpdates", () => {
  it("maps a completed event onto the matching NflGame", () => {
    const { updates, errors } = mapOddsScoresToResultUpdates(
      [
        {
          id: "s1",
          sport_key: "americanfootball_nfl",
          commence_time: "2026-09-11T00:15:00Z",
          completed: true,
          home_team: "Philadelphia Eagles",
          away_team: "Dallas Cowboys",
          scores: [
            { name: "Philadelphia Eagles", score: "24" },
            { name: "Dallas Cowboys", score: "17" },
          ],
        },
      ],
      [
        {
          id: "game-1",
          weekNumber: 1,
          homeTeamId: "phi",
          awayTeamId: "dal",
          kickoffAt: new Date("2026-09-11T00:15:00Z"),
        },
      ],
      TEAMS,
    );
    expect(errors).toHaveLength(0);
    expect(updates).toEqual([
      {
        nflGameId: "game-1",
        weekNumber: 1,
        status: "FINAL",
        homeScore: 24,
        awayScore: 17,
      },
    ]);
  });

  it("skips incomplete events and soft-fails unmatched games", () => {
    const { updates, errors } = mapOddsScoresToResultUpdates(
      [
        {
          id: "live",
          sport_key: "americanfootball_nfl",
          commence_time: "2026-09-11T00:15:00Z",
          completed: false,
          home_team: "Philadelphia Eagles",
          away_team: "Dallas Cowboys",
          scores: null,
        },
        {
          id: "orphan",
          sport_key: "americanfootball_nfl",
          commence_time: "2026-09-11T00:15:00Z",
          completed: true,
          home_team: "Philadelphia Eagles",
          away_team: "Dallas Cowboys",
          scores: [
            { name: "Philadelphia Eagles", score: "10" },
            { name: "Dallas Cowboys", score: "7" },
          ],
        },
      ],
      [],
      TEAMS,
    );
    expect(updates).toHaveLength(0);
    expect(errors.some((e) => e.message === "no_matching_nfl_game")).toBe(true);
  });
});
