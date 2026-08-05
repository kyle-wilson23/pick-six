import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } from "@/lib/nfl/apply-simulation-odds-snapshot";
import {
  cleanupOrphanTestFixtureData,
  countRemainingTestLeagues,
  handlePostTestLeagueDeleteFixtureCleanup,
} from "@/lib/nfl/cleanup-rehearsal-fixtures";

vi.mock("@/lib/nfl/backfill-league-sim-from-legacy-fixtures", () => ({
  backfillLeagueSimFromLegacyFixtures: vi.fn().mockResolvedValue({
    testLeagues: 0,
    simGamesUpserted: 0,
    oddsRunsCreated: 0,
    jailedRowsCopied: 0,
  }),
}));

import { backfillLeagueSimFromLegacyFixtures } from "@/lib/nfl/backfill-league-sim-from-legacy-fixtures";

const SEASON_YEAR = 2026;
const WEEK = 3;

type FixtureGame = { id: string; nflSeasonYear: number; weekNumber: number };

function makeCleanupPrisma(opts: {
  fixtureOnlyGames?: FixtureGame[];
  deleteSnapshotRunsCount?: number;
  deleteGamesCount?: number;
  remainingGamesByWeek?: Record<
    string,
    Array<{ id: string; oddsLines: Array<{ id: string }> }>
  >;
  deleteJailedCount?: number;
}) {
  const {
    fixtureOnlyGames = [],
    deleteSnapshotRunsCount = 0,
    deleteGamesCount = 0,
    remainingGamesByWeek = {},
    deleteJailedCount = 0,
  } = opts;

  const nflGameFindMany = vi
    .fn()
    .mockResolvedValueOnce(fixtureOnlyGames)
    .mockImplementation(({ where }: { where: { nflSeasonYear: number; weekNumber: number } }) => {
      const key = `${where.nflSeasonYear}:${where.weekNumber}`;
      return Promise.resolve(remainingGamesByWeek[key] ?? []);
    });
  const oddsSnapshotRunDeleteMany = vi.fn().mockResolvedValue({ count: deleteSnapshotRunsCount });
  const nflGameDeleteMany = vi.fn().mockResolvedValue({ count: deleteGamesCount });
  const nflWeekJailedTeamDeleteMany = vi.fn().mockResolvedValue({ count: deleteJailedCount });

  const tx = {
    nflGame: {
      findMany: nflGameFindMany,
      deleteMany: nflGameDeleteMany,
    },
    oddsSnapshotRun: { deleteMany: oddsSnapshotRunDeleteMany },
    nflWeekJailedTeam: { deleteMany: nflWeekJailedTeamDeleteMany },
  };

  const prisma = {
    $transaction: vi.fn().mockImplementation(async (fn: (inner: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    league: { count: vi.fn() },
  } as unknown as PrismaClient;

  return {
    prisma,
    tx,
    nflGameFindMany,
    oddsSnapshotRunDeleteMany,
    nflGameDeleteMany,
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
    vi.mocked(backfillLeagueSimFromLegacyFixtures).mockResolvedValue({
      testLeagues: 0,
      simGamesUpserted: 0,
      oddsRunsCreated: 0,
      jailedRowsCopied: 0,
    });
  });

  it("backfills then removes leftover global fixture-only games and empty-week jailed", async () => {
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
      remainingGamesByWeek: { [`${SEASON_YEAR}:${WEEK}`]: [] },
      deleteJailedCount: 1,
    });

    const result = await cleanupOrphanTestFixtureData(prisma);

    expect(backfillLeagueSimFromLegacyFixtures).toHaveBeenCalledWith(prisma);
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

  it("deletes jailed when remaining games lack non-fixture completed odds", async () => {
    const {
      prisma,
      nflWeekJailedTeamDeleteMany,
    } = makeCleanupPrisma({
      fixtureOnlyGames: [
        { id: "game-fixture-1", nflSeasonYear: SEASON_YEAR, weekNumber: WEEK },
      ],
      deleteSnapshotRunsCount: 1,
      deleteGamesCount: 1,
      remainingGamesByWeek: {
        [`${SEASON_YEAR}:${WEEK}`]: [{ id: "orphan-no-odds", oddsLines: [] }],
      },
      deleteJailedCount: 1,
    });

    const result = await cleanupOrphanTestFixtureData(prisma);

    expect(result.deletedJailedRows).toBe(1);
    expect(nflWeekJailedTeamDeleteMany).toHaveBeenCalled();
  });

  it("keeps jailed when remaining games still have non-fixture odds", async () => {
    const {
      prisma,
      nflWeekJailedTeamDeleteMany,
    } = makeCleanupPrisma({
      fixtureOnlyGames: [
        { id: "game-fixture-1", nflSeasonYear: SEASON_YEAR, weekNumber: WEEK },
      ],
      deleteSnapshotRunsCount: 1,
      deleteGamesCount: 1,
      remainingGamesByWeek: {
        [`${SEASON_YEAR}:${WEEK}`]: [{ id: "live-g", oddsLines: [{ id: "line-1" }] }],
      },
      deleteJailedCount: 0,
    });

    const result = await cleanupOrphanTestFixtureData(prisma);

    expect(result.deletedJailedRows).toBe(0);
    expect(nflWeekJailedTeamDeleteMany).not.toHaveBeenCalled();
  });

  it("real-only week: no fixture-only games → no NflGame or jailed deletes", async () => {
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
});

describe("handlePostTestLeagueDeleteFixtureCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(backfillLeagueSimFromLegacyFixtures).mockResolvedValue({
      testLeagues: 0,
      simGamesUpserted: 0,
      oddsRunsCreated: 0,
      jailedRowsCopied: 0,
    });
  });

  it("always cleans leftover global fixtures even when other test leagues remain", async () => {
    const { prisma, nflGameFindMany } = makeCleanupPrisma({
      fixtureOnlyGames: [{ id: "g1", nflSeasonYear: SEASON_YEAR, weekNumber: WEEK }],
      deleteSnapshotRunsCount: 1,
      deleteGamesCount: 1,
      remainingGamesByWeek: { [`${SEASON_YEAR}:${WEEK}`]: [] },
      deleteJailedCount: 1,
    });
    (prisma.league as { count: ReturnType<typeof vi.fn> }).count = vi
      .fn()
      .mockResolvedValue(1);

    const result = await handlePostTestLeagueDeleteFixtureCleanup(prisma, {
      actorUserId: "user-1",
      leagueId: "league-deleted",
    });

    expect(result).toEqual({
      outcome: "fixtures_cleaned",
      deletedSnapshotRuns: 1,
      deletedGames: 1,
      deletedJailedRows: 1,
    });
    expect(nflGameFindMany).toHaveBeenCalled();
  });

  it("runs cleanup when no test leagues remain", async () => {
    const { prisma } = makeCleanupPrisma({
      fixtureOnlyGames: [{ id: "g1", nflSeasonYear: SEASON_YEAR, weekNumber: WEEK }],
      deleteSnapshotRunsCount: 1,
      deleteGamesCount: 2,
      remainingGamesByWeek: { [`${SEASON_YEAR}:${WEEK}`]: [] },
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
