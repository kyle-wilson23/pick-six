import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { backfillLeagueSimFromLegacyFixtures } from "@/lib/nfl/backfill-league-sim-from-legacy-fixtures";

const YEAR = 2026;
const WEEK = 2;

describe("backfillLeagueSimFromLegacyFixtures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is idempotent: second run skips odds/jailed when already present", async () => {
    const fixtureGame = {
      id: "nfl-g1",
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
      homeTeamId: "h",
      awayTeamId: "a",
      kickoffAt: new Date("2026-09-14T17:00:00.000Z"),
      status: "SCHEDULED" as const,
      homeScore: null,
      awayScore: null,
      finalizedAt: null,
    };

    const leagueSimGameUpsert = vi.fn().mockResolvedValue({});
    const leagueSimOddsCreate = vi.fn();
    const leagueJailedCreate = vi.fn();
    const findFirstOdds = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "existing-run" });
    const findUniqueLeagueJailed = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "existing-jailed" });

    const prisma = {
      league: {
        findMany: vi.fn().mockResolvedValue([{ id: "test-league" }]),
      },
      nflGame: {
        findMany: vi.fn().mockResolvedValue([fixtureGame]),
      },
      oddsSnapshotRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "run-1",
            nflSeasonYear: YEAR,
            weekNumber: WEEK,
            completedAt: new Date("2026-09-10T12:00:00.000Z"),
            lines: [
              {
                nflGameId: "nfl-g1",
                homeMoneylineAmerican: -150,
                awayMoneylineAmerican: 130,
                homeSpreadPoints: null,
              },
            ],
          },
        ]),
      },
      leagueSimGame: {
        upsert: leagueSimGameUpsert,
        findMany: vi.fn().mockResolvedValue([{ id: "sim-g1", homeTeamId: "h", awayTeamId: "a" }]),
      },
      leagueSimOddsSnapshotRun: {
        findFirst: findFirstOdds,
        create: leagueSimOddsCreate.mockResolvedValue({ id: "new-run" }),
      },
      leagueWeekJailedTeam: {
        findUnique: findUniqueLeagueJailed,
        create: leagueJailedCreate,
      },
      nflWeekJailedTeam: {
        findUnique: vi.fn().mockResolvedValue({
          jailedTeamId: "h",
          resolvedBy: "MONEYLINE",
          randomSeed: null,
          auditJson: { v: 1 },
          computedAt: new Date("2026-09-10T12:00:00.000Z"),
          oddsLineSourceNote: "note",
        }),
      },
    } as unknown as PrismaClient;

    const first = await backfillLeagueSimFromLegacyFixtures(prisma);
    expect(first.testLeagues).toBe(1);
    expect(first.simGamesUpserted).toBe(1);
    expect(first.oddsRunsCreated).toBe(1);
    expect(first.jailedRowsCopied).toBe(1);
    expect(leagueSimOddsCreate).toHaveBeenCalledOnce();
    expect(leagueJailedCreate).toHaveBeenCalledOnce();

    const second = await backfillLeagueSimFromLegacyFixtures(prisma);
    expect(second.simGamesUpserted).toBe(1);
    expect(second.oddsRunsCreated).toBe(0);
    expect(second.jailedRowsCopied).toBe(0);
    expect(leagueSimOddsCreate).toHaveBeenCalledOnce();
    expect(leagueJailedCreate).toHaveBeenCalledOnce();
  });

  it("no-ops when there are no test leagues", async () => {
    const prisma = {
      league: { findMany: vi.fn().mockResolvedValue([]) },
      nflGame: { findMany: vi.fn().mockResolvedValue([]) },
      oddsSnapshotRun: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;

    const stats = await backfillLeagueSimFromLegacyFixtures(prisma);

    expect(stats).toEqual({
      testLeagues: 0,
      simGamesUpserted: 0,
      oddsRunsCreated: 0,
      jailedRowsCopied: 0,
    });
  });
});
