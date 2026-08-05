import type { PrismaClient } from "@prisma/client";

import { ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } from "@/lib/nfl/apply-simulation-odds-snapshot";
import { backfillLeagueSimFromLegacyFixtures } from "@/lib/nfl/backfill-league-sim-from-legacy-fixtures";

export type RehearsalFixtureCleanupStats = {
  deletedSnapshotRuns: number;
  deletedGames: number;
  deletedJailedRows: number;
};

export type PostTestLeagueDeleteFixtureOutcome =
  | ({ outcome: "fixtures_cleaned" } & RehearsalFixtureCleanupStats)
  | { outcome: "cleanup_failed"; error: unknown };

/** Count leagues still marked `isTestLeague` (call after the deleted league row is gone). */
export async function countRemainingTestLeagues(prisma: PrismaClient): Promise<number> {
  return prisma.league.count({ where: { isTestLeague: true } });
}

/**
 * Remove leftover global rehearsal fixture rows stamped onto `NflGame` before hybrid Option B.
 *
 * Sim schedule/odds/jailed for test leagues now live on league-scoped tables and cascade with
 * `League` delete — this only cleans orphan **canonical** `test_fixture`-only games and
 * legacy global `OddsSnapshotRun` rows with `source=test_fixture`.
 *
 * Before deletes, backfills remaining test leagues from legacy fixture rows (idempotent).
 */
export async function cleanupOrphanTestFixtureData(
  prisma: PrismaClient,
): Promise<RehearsalFixtureCleanupStats> {
  await backfillLeagueSimFromLegacyFixtures(prisma);

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
      const remainingGames = await tx.nflGame.findMany({
        where: { nflSeasonYear, weekNumber },
        select: {
          id: true,
          oddsLines: {
            where: {
              oddsSnapshotRun: {
                status: "COMPLETED",
                source: { not: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE },
              },
            },
            select: { id: true },
            take: 1,
          },
        },
      });

      const hasNonFixtureOdds = remainingGames.some((g) => g.oddsLines.length > 0);
      if (remainingGames.length === 0 || !hasNonFixtureOdds) {
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
 * After a test league row is deleted, sim games/odds/jailed cascade with the league.
 * Always attempt one-off cleanup of leftover global `test_fixture` NflGame rows (pre-hybrid).
 * Does **not** retain shared schedule fixtures for remaining test leagues.
 */
export async function handlePostTestLeagueDeleteFixtureCleanup(
  prisma: PrismaClient,
  params: { actorUserId: string; leagueId: string },
): Promise<PostTestLeagueDeleteFixtureOutcome> {
  const timestamp = new Date().toISOString();

  try {
    const remainingTestLeagueCount = await countRemainingTestLeagues(prisma);
    const stats = await cleanupOrphanTestFixtureData(prisma);
    console.info(
      JSON.stringify({
        action: "rehearsal_fixtures_cleaned",
        leagueId: params.leagueId,
        actorUserId: params.actorUserId,
        remainingTestLeagueCount,
        note: "sim_data_cascaded_with_league; cleaned_legacy_global_test_fixture_rows",
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
