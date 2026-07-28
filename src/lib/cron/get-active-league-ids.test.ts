import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSeasonFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    season: {
      findMany: (...args: unknown[]) => mockSeasonFindMany(...args),
    },
  },
}));

vi.mock("@/lib/league/nfl-season", () => ({
  getCurrentNflSeasonYear: () => 2026,
}));

import { getActiveLeagueIds } from "./get-active-league-ids";

describe("getActiveLeagueIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSeasonFindMany.mockResolvedValue([{ leagueId: "league-1" }]);
  });

  it("excludes test leagues from the active season query", async () => {
    const ids = await getActiveLeagueIds();

    expect(ids).toEqual(["league-1"]);
    expect(mockSeasonFindMany).toHaveBeenCalledWith({
      where: {
        nflSeasonYear: 2026,
        preSeasonInitializedAt: { not: null },
        league: { isTestLeague: false },
      },
      select: { leagueId: true },
    });
  });
});
