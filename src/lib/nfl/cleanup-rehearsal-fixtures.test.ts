import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } from "@/lib/nfl/apply-simulation-odds-snapshot";
import {
  cleanupOrphanTestFixtureData,
  countRemainingTestLeagues,
  handlePostTestLeagueDeleteFixtureCleanup,
} from "@/lib/nfl/cleanup-rehearsal-fixtures";

const SEASON_YEAR = 2026;
const WEEK = 3;

type FixtureGame = { id: string; nflSeasonYear: number; weekNumber: number };

function makeCleanupPrisma(opts: {
  fixtureOnlyGames?: FixtureGame[];
  deleteSnapshotRunsCount?: number;
  deleteGamesCount?: number;
  gamesRemainingByWeek?: Record<string, number>;
  deleteJailedCount?: number;
}) {
  const {
    fixtureOnlyGames = [],
    deleteSnapshotRunsCount = 0,
    deleteGamesCount = 0,
    gamesRemainingByWeek = {},
    deleteJailedCount = 0,
  } = opts;

  const nflGameFindMany = vi.fn().mockResolvedValue(fixtureOnlyGames);
  const oddsSnapshotRunDeleteMany = vi.fn().mockResolvedValue({ count: deleteSnapshotRunsCount });
  const nflGameDeleteMany = vi.fn().mockResolvedValue({ count: deleteGamesCount });
  const nflGameCount = vi.fn().mockImplementation(({ where }: { where: { nflSeasonYear: number; weekNumber: number } }) => {
    const key = `${where.nflSeasonYear}:${where.weekNumber}`;
    return Promise.resolve(gamesRemainingByWeek[key] ?? 0);
  });
  const nflWeekJailedTeamDeleteMany = vi.fn().mockResolvedValue({ count: deleteJailedCount });

  const tx = {
    nflGame: {
      findMany: nflGameFindMany,
      deleteMany: nflGameDeleteMany,
      count: nflGameCount,
    },
    oddsSnapshotRun: { deleteMany: oddsSnapshotRunDeleteMany },
    nflWeekJailedTeam: { deleteMany: nflWeekJailedTeamDeleteMany },
  };

  const prisma = {
    $transaction: vi.fn().mockImplementation(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
    league: { count: vi.fn() },
  } as unknown as PrismaClient;

  return {
    prisma,
    tx,
    nflGameFindMany,
    oddsSnapshotRunDeleteMany,
    nflGameDeleteMany,
    nflGameCount,
    nflWeekJailedTeamDeleteMany,
  };
}

describe("countRemainingTestLeagues", () => {
  it("counts leagues with isTestLeague true", async () => {
    const prisma = {
      league: { count: vi.fn().mockResolvedValue(2) },
    } as unknown as PrismaClient;

    const count = await countRemainingTestLeagues(prisma);

    expect(count).toBe(2);
    expect(prisma.league.count).toHaveBeenCalledWith({ where: { isTestLeague: true } });
  });
});

describe("cleanupOrphanTestFixtureData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes fixture-only games, test_fixture runs, and jailed rows for empty weeks", async () => {
    const fixtureOnlyGames = [
      { id: "game-fixture-1", nflSeasonYear: SEASON_YEAR, weekNumber: WEEK },
    ];
    const {
      prisma,
      nflGameFindMany,
      oddsSnapshotRunDeleteMany,
      nflGameDeleteMany,
      nflWeekJailedTeamDeleteMany,
    } = makeCleanupPrisma({
      fixtureOnlyGames,
      deleteSnapshotRunsCount: 2,
      deleteGamesCount: 1,
      gamesRemainingByWeek: { [`${SEASON_YEAR}:${WEEK}`]: 0 },
      deleteJailedCount: 1,
    });

    const result = await cleanupOrphanTestFixtureData(prisma);

    expect(result).toEqual({
      deletedSnapshotRuns: 2,
      deletedGames: 1,
      deletedJailedRows: 1,
    });

    expect(nflGameFindMany).toHaveBeenCalledWith({
      where: {
        oddsLines: {
          some: {
            oddsSnapshotRun: { source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE },
          },
          none: {
            oddsSnapshotRun: { source: { not: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } },
          },
        },
      },
      select: { id: true, nflSeasonYear: true, weekNumber: true },
    });
    expect(oddsSnapshotRunDeleteMany).toHaveBeenCalledWith({
      where: { source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE },
    });
    expect(nflGameDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["game-fixture-1"] } },
    });
    expect(nflWeekJailedTeamDeleteMany).toHaveBeenCalledWith({
      where: { nflSeasonYear: SEASON_YEAR, weekNumber: WEEK },
    });
  });

  it("keeps mixed-provenance games: only fixture-only ids deleted; runs deleted; jailed kept if games remain", async () => {
    // Query returns only exclusive test_fixture games — mixed-source games are
    // filtered out by oddsLines.none { source not test_fixture }.
    const fixtureOnlyGames = [
      { id: "game-fixture-only", nflSeasonYear: SEASON_YEAR, weekNumber: WEEK },
    ];
    const {
      prisma,
      nflGameFindMany,
      oddsSnapshotRunDeleteMany,
      nflGameDeleteMany,
      nflWeekJailedTeamDeleteMany,
    } = makeCleanupPrisma({
      fixtureOnlyGames,
      deleteSnapshotRunsCount: 1,
      deleteGamesCount: 1,
      // Remaining includes a mixed-provenance (or real) game still in the week
      gamesRemainingByWeek: { [`${SEASON_YEAR}:${WEEK}`]: 1 },
    });

    const result = await cleanupOrphanTestFixtureData(prisma);

    expect(nflGameFindMany).toHaveBeenCalledWith({
      where: {
        oddsLines: {
          some: {
            oddsSnapshotRun: { source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE },
          },
          none: {
            oddsSnapshotRun: { source: { not: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } },
          },
        },
      },
      select: { id: true, nflSeasonYear: true, weekNumber: true },
    });
    expect(oddsSnapshotRunDeleteMany).toHaveBeenCalledWith({
      where: { source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE },
    });
    expect(nflGameDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["game-fixture-only"] } },
    });
    expect(nflGameDeleteMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: expect.arrayContaining(["game-mixed"]) } },
      }),
    );
    expect(result.deletedGames).toBe(1);
    expect(result.deletedSnapshotRuns).toBe(1);
    expect(result.deletedJailedRows).toBe(0);
    expect(nflWeekJailedTeamDeleteMany).not.toHaveBeenCalled();
  });

  it("real-only week: no test_fixture runs → no games or jailed deleted", async () => {
    const {
      prisma,
      nflGameDeleteMany,
      nflWeekJailedTeamDeleteMany,
      oddsSnapshotRunDeleteMany,
    } = makeCleanupPrisma({
      fixtureOnlyGames: [],
      deleteSnapshotRunsCount: 0,
    });

    const result = await cleanupOrphanTestFixtureData(prisma);

    expect(result).toEqual({
      deletedSnapshotRuns: 0,
      deletedGames: 0,
      deletedJailedRows: 0,
    });
    expect(oddsSnapshotRunDeleteMany).toHaveBeenCalledWith({
      where: { source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE },
    });
    expect(nflGameDeleteMany).not.toHaveBeenCalled();
    expect(nflWeekJailedTeamDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes test_fixture runs but no games or jailed rows when no fixture-only games exist", async () => {
    const { prisma, nflGameDeleteMany, nflWeekJailedTeamDeleteMany, oddsSnapshotRunDeleteMany } =
      makeCleanupPrisma({
        fixtureOnlyGames: [],
        deleteSnapshotRunsCount: 3,
      });

    const result = await cleanupOrphanTestFixtureData(prisma);

    expect(result).toEqual({
      deletedSnapshotRuns: 3,
      deletedGames: 0,
      deletedJailedRows: 0,
    });
    expect(oddsSnapshotRunDeleteMany).toHaveBeenCalled();
    expect(nflGameDeleteMany).not.toHaveBeenCalled();
    expect(nflWeekJailedTeamDeleteMany).not.toHaveBeenCalled();
  });
});

describe("handlePostTestLeagueDeleteFixtureCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips cleanup when other test leagues remain", async () => {
    const { prisma, nflGameFindMany } = makeCleanupPrisma({});
    (prisma.league as { count: ReturnType<typeof vi.fn> }).count = vi
      .fn()
      .mockResolvedValue(1);

    const result = await handlePostTestLeagueDeleteFixtureCleanup(prisma, {
      actorUserId: "user-1",
      leagueId: "league-deleted",
    });

    expect(result).toEqual({
      outcome: "fixtures_retained",
      remainingTestLeagueCount: 1,
    });
    expect(nflGameFindMany).not.toHaveBeenCalled();
  });

  it("runs cleanup when no test leagues remain", async () => {
    const { prisma } = makeCleanupPrisma({
      fixtureOnlyGames: [{ id: "g1", nflSeasonYear: SEASON_YEAR, weekNumber: WEEK }],
      deleteSnapshotRunsCount: 1,
      deleteGamesCount: 2,
      gamesRemainingByWeek: { [`${SEASON_YEAR}:${WEEK}`]: 0 },
      deleteJailedCount: 1,
    });
    (prisma.league as { count: ReturnType<typeof vi.fn> }).count = vi
      .fn()
      .mockResolvedValue(0);

    const result = await handlePostTestLeagueDeleteFixtureCleanup(prisma, {
      actorUserId: "user-1",
      leagueId: "league-deleted",
    });

    expect(result).toEqual({
      outcome: "fixtures_cleaned",
      deletedSnapshotRuns: 1,
      deletedGames: 2,
      deletedJailedRows: 1,
    });
  });

  it("returns cleanup_failed when remaining-count throws after league delete", async () => {
    const { prisma, nflGameFindMany } = makeCleanupPrisma({});
    (prisma.league as { count: ReturnType<typeof vi.fn> }).count = vi
      .fn()
      .mockRejectedValue(new Error("db unavailable"));

    const result = await handlePostTestLeagueDeleteFixtureCleanup(prisma, {
      actorUserId: "user-1",
      leagueId: "league-deleted",
    });

    expect(result.outcome).toBe("cleanup_failed");
    expect(nflGameFindMany).not.toHaveBeenCalled();
  });
});
