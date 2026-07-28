import type { PrismaClient } from "@prisma/client";

import { ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } from "@/lib/nfl/apply-simulation-odds-snapshot";

export type RehearsalFixtureCleanupStats = {
  deletedSnapshotRuns: number;
  deletedGames: number;
  deletedJailedRows: number;
};

export type PostTestLeagueDeleteFixtureOutcome =
  | { outcome: "fixtures_retained"; remainingTestLeagueCount: number }
  | ({ outcome: "fixtures_cleaned" } & RehearsalFixtureCleanupStats)
  | { outcome: "cleanup_failed"; error: unknown };

/** Count leagues still marked `isTestLeague` (call after the deleted league row is gone). */
export async function countRemainingTestLeagues(prisma: PrismaClient): Promise<number> {
  return prisma.league.count({ where: { isTestLeague: true } });
}

/**
 * Remove global rehearsal fixture rows when no test leagues remain.
 *
 * Provenance: only deletes `NflGame` rows whose odds lines are exclusively from
 * `test_fixture` snapshot runs. Mixed weeks keep real-sourced games and jailed rows.
 */
export async function cleanupOrphanTestFixtureData(
  prisma: PrismaClient,
): Promise<RehearsalFixtureCleanupStats> {
  return prisma.$transaction(async (tx) => {
    const fixtureOnlyGames = await tx.nflGame.findMany({
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

    const fixtureOnlyGameIds = fixtureOnlyGames.map((g) => g.id);
    const affectedWeekKeys = new Set(
      fixtureOnlyGames.map((g) => `${g.nflSeasonYear}:${g.weekNumber}`),
    );

    const deletedSnapshotRuns = await tx.oddsSnapshotRun.deleteMany({
      where: { source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE },
    });

    const deletedGames =
      fixtureOnlyGameIds.length > 0
        ? await tx.nflGame.deleteMany({ where: { id: { in: fixtureOnlyGameIds } } })
        : { count: 0 };

    let deletedJailedRows = 0;
    for (const weekKey of affectedWeekKeys) {
      const [nflSeasonYear, weekNumber] = weekKey.split(":").map(Number);
      const remainingGames = await tx.nflGame.count({
        where: { nflSeasonYear, weekNumber },
      });
      if (remainingGames === 0) {
        const result = await tx.nflWeekJailedTeam.deleteMany({
          where: { nflSeasonYear, weekNumber },
        });
        deletedJailedRows += result.count;
      }
    }

    return {
      deletedSnapshotRuns: deletedSnapshotRuns.count,
      deletedGames: deletedGames.count,
      deletedJailedRows,
    };
  });
}

/**
 * After a test league row is deleted, retain shared fixtures while other test leagues exist;
 * otherwise run global fixture cleanup (Story 8.7 AC2/AC3).
 */
export async function handlePostTestLeagueDeleteFixtureCleanup(
  prisma: PrismaClient,
  params: { actorUserId: string; leagueId: string },
): Promise<PostTestLeagueDeleteFixtureOutcome> {
  const timestamp = new Date().toISOString();

  try {
    const remainingTestLeagueCount = await countRemainingTestLeagues(prisma);

    if (remainingTestLeagueCount > 0) {
      console.info(
        JSON.stringify({
          action: "rehearsal_fixtures_retained",
          reason: "other_test_leagues_remain",
          remainingTestLeagueCount,
          leagueId: params.leagueId,
          actorUserId: params.actorUserId,
          timestamp,
        }),
      );
      return { outcome: "fixtures_retained", remainingTestLeagueCount };
    }

    const stats = await cleanupOrphanTestFixtureData(prisma);
    console.info(
      JSON.stringify({
        action: "rehearsal_fixtures_cleaned",
        leagueId: params.leagueId,
        actorUserId: params.actorUserId,
        ...stats,
        timestamp,
      }),
    );
    return { outcome: "fixtures_cleaned", ...stats };
  } catch (error) {
    console.error(
      JSON.stringify({
        action: "rehearsal_fixtures_cleanup_failed",
        leagueId: params.leagueId,
        actorUserId: params.actorUserId,
        error: error instanceof Error ? error.message : "unknown",
        timestamp: new Date().toISOString(),
      }),
    );
    return { outcome: "cleanup_failed", error };
  }
}
