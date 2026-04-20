import { describe, expect, it } from "vitest";

import { theOddsApiOddsResponseSchema } from "@/lib/integrations/the-odds-api/schemas";

import sample from "@/lib/integrations/the-odds-api/fixtures/nfl-odds-sample.json";
import { matchTheOddsEventsToGames } from "@/lib/nfl/match-the-odds-events";

describe("matchTheOddsEventsToGames", () => {
  it("matches API event to DB game by team names and orientation", () => {
    const events = theOddsApiOddsResponseSchema.parse(sample);
    const games = [
      {
        id: "game-db-1",
        homeTeamName: "Kansas City Chiefs",
        awayTeamName: "Las Vegas Raiders",
      },
    ];
    const m = matchTheOddsEventsToGames(events, games);
    expect(m.size).toBe(1);
    const line = m.get("game-db-1");
    expect(line?.homeMoneylineAmerican).toBe(-250);
    expect(line?.homeSpreadPoints).toBe(-7.5);
  });
});
