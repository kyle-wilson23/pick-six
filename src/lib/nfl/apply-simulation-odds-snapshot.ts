import { Prisma, type PrismaClient } from "@prisma/client";

import { deriveFixtureOddsLine } from "@/lib/domain/derive-fixture-odds-line";
import {
  buildFixtureKickoffTimes,
  selectFixtureMatchups,
} from "@/lib/nfl/simulation-fixture-schedule";
import {
  computeAndPersistNflWeekJailed,
  type JailedComputeActor,
} from "@/lib/nfl/jailed-computation";

/** Distinct from `the_odds_api` / `manual` so operators can audit fixture rehearsal rows (AC8). */
export const ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE = "test_fixture";

export type ApplySimulationOddsSnapshotSuccess = {
  ok: true;
  nflSeasonYear: number;
  weekNumber: number;
  gamesInWeek: number;
  oddsSnapshotRunId: string;
  jailedTeamId: string;
  jailedTeamAbbreviation: string;
  resolvedBy: "MONEYLINE" | "SPREAD" | "RANDOM";
};

export type ApplySimulationOddsSnapshotFailure = {
  ok: false;
  code: string;
  message: string;
  httpStatus: number;
};

export type ApplySimulationOddsSnapshotResult =
  | ApplySimulationOddsSnapshotSuccess
  | ApplySimulationOddsSnapshotFailure;

/**
 * Ensure games exist for `(nflSeasonYear, weekNumber)` (create from fixture only when none),
 * write a completed `test_fixture` odds snapshot, then run the production jailed algorithm.
 *
 * Not league-scoped — callers must gate on `isTestLeague` before invoking (Story 8.3 AC7).
 */
export async function applySimulationOddsSnapshot(
  prisma: PrismaClient,
  params: { nflSeasonYear: number; weekNumber: number },
  actor: JailedComputeActor,
  now: Date = new Date(),
): Promise<ApplySimulationOddsSnapshotResult> {
  const { nflSeasonYear, weekNumber } = params;

  let games = await prisma.nflGame.findMany({
    where: { nflSeasonYear, weekNumber },
    select: { id: true, homeTeamId: true, awayTeamId: true },
  });

  if (games.length === 0) {
    await ensureFixtureGamesForWeek(prisma, { nflSeasonYear, weekNumber, now });
    games = await prisma.nflGame.findMany({
      where: { nflSeasonYear, weekNumber },
      select: { id: true, homeTeamId: true, awayTeamId: true },
    });
  }

  if (games.length === 0) {
    // Defensive-only: unreachable while the fixture JSON keeps its structural ≥4-games-per-week
    // guarantee. Distinct from jailed.ts / jailed-computation.ts / snapshot-nfl-week-odds.ts's
    // own (differently-scoped) `NO_GAMES_FOR_WEEK` so callers can tell them apart by code.
    return {
      ok: false,
      code: "FIXTURE_GAMES_UNAVAILABLE",
      message: "No NFL games available for this simulated week after fixture ensure",
      httpStatus: 409,
    };
  }

  const completedAt = new Date();
  // Single transaction so a failure between the two writes cannot leave a `COMPLETED`
  // `OddsSnapshotRun` with zero `NflGameOddsLine` rows (which `getEffectiveOddsLinesForWeek`'s
  // "latest completed wins" merge would otherwise treat as authoritative-but-empty).
  const run = await prisma.$transaction(async (tx) => {
    const createdRun = await tx.oddsSnapshotRun.create({
      data: {
        nflSeasonYear,
        weekNumber,
        status: "COMPLETED",
        source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE,
        completedAt,
      },
    });

    await tx.nflGameOddsLine.createMany({
      data: games.map((g) => {
        const line = deriveFixtureOddsLine({
          nflSeasonYear,
          weekNumber,
          homeTeamId: g.homeTeamId,
          awayTeamId: g.awayTeamId,
        });
        return {
          nflGameId: g.id,
          oddsSnapshotRunId: createdRun.id,
          homeMoneylineAmerican: line.homeMoneylineAmerican,
          awayMoneylineAmerican: line.awayMoneylineAmerican,
          homeSpreadPoints: new Prisma.Decimal(line.homeSpreadPoints),
        };
      }),
    });

    return createdRun;
  });

  const jailed = await computeAndPersistNflWeekJailed(
    prisma,
    { nflSeasonYear, weekNumber },
    actor,
  );

  if (!jailed.ok) {
    return {
      ok: false,
      code: jailed.error.code,
      message: jailed.error.message,
      httpStatus: jailed.error.httpStatus,
    };
  }

  return {
    ok: true,
    nflSeasonYear,
    weekNumber,
    gamesInWeek: games.length,
    oddsSnapshotRunId: run.id,
    jailedTeamId: jailed.row.jailedTeamId,
    jailedTeamAbbreviation: jailed.row.jailedTeam.abbreviation,
    resolvedBy: jailed.result.resolvedBy,
  };
}

async function ensureFixtureGamesForWeek(
  prisma: PrismaClient,
  args: { nflSeasonYear: number; weekNumber: number; now: Date },
): Promise<void> {
  const { nflSeasonYear, weekNumber, now } = args;
  const matchups = selectFixtureMatchups(weekNumber);
  const abbreviations = [...new Set(matchups.flatMap((m) => [m.home, m.away]))];

  const teams = await prisma.team.findMany({
    where: { abbreviation: { in: abbreviations } },
    select: { id: true, abbreviation: true },
  });
  const byAbbr = new Map(teams.map((t) => [t.abbreviation, t.id]));

  for (const abbr of abbreviations) {
    if (!byAbbr.has(abbr)) {
      throw new Error(
        `ensureFixtureGamesForWeek: team abbreviation ${abbr} not found — seed nfl teams first`,
      );
    }
  }

  const kickoffs = buildFixtureKickoffTimes(now, matchups.length);

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < matchups.length; i++) {
      const m = matchups[i]!;
      const homeTeamId = byAbbr.get(m.home)!;
      const awayTeamId = byAbbr.get(m.away)!;
      await tx.nflGame.upsert({
        where: {
          nflSeasonYear_weekNumber_homeTeamId_awayTeamId: {
            nflSeasonYear,
            weekNumber,
            homeTeamId,
            awayTeamId,
          },
        },
        create: {
          nflSeasonYear,
          weekNumber,
          homeTeamId,
          awayTeamId,
          kickoffAt: kickoffs[i]!,
        },
        // Existing row (race / prior ensure): leave kickoff untouched — "real data wins".
        update: {},
      });
    }
  });
}
