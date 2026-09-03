import type { Prisma, PrismaClient } from "@prisma/client";

import { ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } from "@/lib/nfl/apply-simulation-odds-snapshot";

export type BackfillLeagueSimFromLegacyFixturesStats = {
  testLeagues: number;
  simGamesUpserted: number;
  oddsRunsCreated: number;
  jailedRowsCopied: number;
};

type Db = PrismaClient | Prisma.TransactionClient;

/** Fixture-only canonical games: have test_fixture odds and no non-fixture odds. */
const FIXTURE_ONLY_GAME_WHERE = {
  oddsLines: {
    some: {
      oddsSnapshotRun: { source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE },
    },
    none: {
      oddsSnapshotRun: { source: { not: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } },
    },
  },
} as const;

/**
 * Idempotent migration of pre-hybrid global fixture rows into per-test-league sim tables.
 * Safe to re-run: upserts games by natural key; skips weeks that already have sim odds/jailed.
 */
export async function backfillLeagueSimFromLegacyFixtures(
  prisma: Db,
): Promise<BackfillLeagueSimFromLegacyFixturesStats> {
  const testLeagues = await prisma.league.findMany({
    where: { isTestLeague: true },
    select: { id: true },
  });

  const fixtureGames = await prisma.nflGame.findMany({
    where: FIXTURE_ONLY_GAME_WHERE,
    select: {
      id: true,
      nflSeasonYear: true,
      weekNumber: true,
      homeTeamId: true,
      awayTeamId: true,
      kickoffAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
      finalizedAt: true,
    },
  });

  let simGamesUpserted = 0;
  let oddsRunsCreated = 0;
  let jailedRowsCopied = 0;

  const fixtureRuns = await prisma.oddsSnapshotRun.findMany({
    where: {
      source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE,
      status: "COMPLETED",
    },
    select: {
      id: true,
      nflSeasonYear: true,
      weekNumber: true,
      completedAt: true,
      lines: {
        select: {
          nflGameId: true,
          homeMoneylineAmerican: true,
          awayMoneylineAmerican: true,
          homeSpreadPoints: true,
        },
      },
    },
  });

  const nflGameById = new Map(fixtureGames.map((g) => [g.id, g]));
  // Also load games referenced by fixture runs that might not match fixture-only filter
  // (mixed weeks) — map natural keys for line remapping.
  const lineGameIds = [
    ...new Set(fixtureRuns.flatMap((r) => r.lines.map((l) => l.nflGameId))),
  ];
  const missingIds = lineGameIds.filter((id) => !nflGameById.has(id));
  if (missingIds.length > 0) {
    const extra = await prisma.nflGame.findMany({
      where: { id: { in: missingIds } },
      select: {
        id: true,
        nflSeasonYear: true,
        weekNumber: true,
        homeTeamId: true,
        awayTeamId: true,
        kickoffAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        finalizedAt: true,
      },
    });
    for (const g of extra) {
      nflGameById.set(g.id, g);
    }
  }

  for (const league of testLeagues) {
    for (const game of fixtureGames) {
      await prisma.leagueSimGame.upsert({
        where: {
          leagueId_nflSeasonYear_weekNumber_homeTeamId_awayTeamId: {
            leagueId: league.id,
            nflSeasonYear: game.nflSeasonYear,
            weekNumber: game.weekNumber,
            homeTeamId: game.homeTeamId,
            awayTeamId: game.awayTeamId,
          },
        },
        create: {
          leagueId: league.id,
          nflSeasonYear: game.nflSeasonYear,
          weekNumber: game.weekNumber,
          homeTeamId: game.homeTeamId,
          awayTeamId: game.awayTeamId,
          kickoffAt: game.kickoffAt,
          status: game.status,
          homeScore: game.homeScore,
          awayScore: game.awayScore,
          finalizedAt: game.finalizedAt,
        },
        update: {},
      });
      simGamesUpserted += 1;
    }

    for (const run of fixtureRuns) {
      const existingOdds = await prisma.leagueSimOddsSnapshotRun.findFirst({
        where: {
          leagueId: league.id,
          nflSeasonYear: run.nflSeasonYear,
          weekNumber: run.weekNumber,
        },
        select: { id: true },
      });
      if (existingOdds) {
        continue;
      }

      const simGames = await prisma.leagueSimGame.findMany({
        where: {
          leagueId: league.id,
          nflSeasonYear: run.nflSeasonYear,
          weekNumber: run.weekNumber,
        },
        select: {
          id: true,
          homeTeamId: true,
          awayTeamId: true,
        },
      });
      const simByMatchup = new Map(
        simGames.map((g) => [`${g.homeTeamId}:${g.awayTeamId}`, g.id]),
      );

      const lineData: Array<{
        leagueSimGameId: string;
        homeMoneylineAmerican: Prisma.Decimal | number | null;
        awayMoneylineAmerican: Prisma.Decimal | number | null;
        homeSpreadPoints: Prisma.Decimal | null;
      }> = [];

      for (const line of run.lines) {
        const nflGame = nflGameById.get(line.nflGameId);
        if (!nflGame) {
          continue;
        }
        const simId = simByMatchup.get(`${nflGame.homeTeamId}:${nflGame.awayTeamId}`);
        if (!simId) {
          continue;
        }
        lineData.push({
          leagueSimGameId: simId,
          homeMoneylineAmerican: line.homeMoneylineAmerican,
          awayMoneylineAmerican: line.awayMoneylineAmerican,
          homeSpreadPoints: line.homeSpreadPoints,
        });
      }

      if (lineData.length === 0) {
        continue;
      }

      const createdRun = await prisma.leagueSimOddsSnapshotRun.create({
        data: {
          leagueId: league.id,
          nflSeasonYear: run.nflSeasonYear,
          weekNumber: run.weekNumber,
          status: "COMPLETED",
          source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE,
          completedAt: run.completedAt ?? new Date(),
          lines: {
            create: lineData,
          },
        },
        select: { id: true },
      });
      void createdRun;
      oddsRunsCreated += 1;
    }

    const weekKeys = new Set(
      fixtureRuns.map((r) => `${r.nflSeasonYear}:${r.weekNumber}`),
    );
    for (const weekKey of weekKeys) {
      const [yearStr, weekStr] = weekKey.split(":");
      const nflSeasonYear = Number(yearStr);
      const weekNumber = Number(weekStr);

      const existingLeagueJailed = await prisma.leagueWeekJailedTeam.findUnique({
        where: {
          leagueId_nflSeasonYear_weekNumber: {
            leagueId: league.id,
            nflSeasonYear,
            weekNumber,
          },
        },
        select: { id: true },
      });
      if (existingLeagueJailed) {
        continue;
      }

      const globalJailed = await prisma.nflWeekJailedTeam.findUnique({
        where: { nflSeasonYear_weekNumber: { nflSeasonYear, weekNumber } },
        select: {
          jailedTeamId: true,
          resolvedBy: true,
          randomSeed: true,
          auditJson: true,
          computedAt: true,
          oddsLineSourceNote: true,
        },
      });
      if (!globalJailed) {
        continue;
      }

      await prisma.leagueWeekJailedTeam.create({
        data: {
          leagueId: league.id,
          nflSeasonYear,
          weekNumber,
          jailedTeamId: globalJailed.jailedTeamId,
          resolvedBy: globalJailed.resolvedBy,
          randomSeed: globalJailed.randomSeed,
          auditJson: globalJailed.auditJson as Prisma.InputJsonValue,
          computedAt: globalJailed.computedAt,
          oddsLineSourceNote: globalJailed.oddsLineSourceNote,
        },
      });
      jailedRowsCopied += 1;
    }
  }

  return {
    testLeagues: testLeagues.length,
    simGamesUpserted,
    oddsRunsCreated,
    jailedRowsCopied,
  };
}
