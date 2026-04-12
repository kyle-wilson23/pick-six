import { describe, expect, it } from "vitest";

import { resolveCurrentSeasonForLeague } from "./resolve-current-season";

describe("resolveCurrentSeasonForLeague", () => {
  it("finds by leagueId and nflSeasonYear composite key", async () => {
    const calls: unknown[] = [];
    const db = {
      findUnique: async (args: unknown) => {
        calls.push(args);
        return { id: "season-1", leagueId: "league-1", nflSeasonYear: 2026 };
      },
    };
    await resolveCurrentSeasonForLeague(db, "league-1", 2026);
    expect(calls).toEqual([
      {
        where: { leagueId_nflSeasonYear: { leagueId: "league-1", nflSeasonYear: 2026 } },
      },
    ]);
  });
});
