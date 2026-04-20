import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { ExtractedOddsLine } from "@/lib/integrations/the-odds-api/extract-lines";
import { fetchAmericanFootballNflOdds, TheOddsApiError } from "@/lib/integrations/the-odds-api/client";
import { matchTheOddsEventsToGames } from "@/lib/nfl/match-the-odds-events";

const SOURCE_THE_ODDS_API = "the_odds_api";

export type SnapshotNflWeekOddsResult =
  | {
      ok: true;
      runId: string;
      matchedGames: number;
      totalGamesInWeek: number;
    }
  | {
      ok: false;
      runId: string;
      code: string;
      message: string;
      httpStatus: number;
    };

function isLineComplete(
  line: ExtractedOddsLine,
): line is ExtractedOddsLine & {
  homeMoneylineAmerican: number;
  awayMoneylineAmerican: number;
  homeSpreadPoints: number;
} {
  return (
    line.homeMoneylineAmerican !== null &&
    line.awayMoneylineAmerican !== null &&
    line.homeSpreadPoints !== null
  );
}

/**
 * Fetches odds from The Odds API and persists a **new** completed snapshot run for the week.
 * Does **not** auto-refresh mid-week — callers trigger explicitly (Tuesday cadence / admin).
 */
export async function snapshotNflWeekOddsFromProvider(
  prisma: PrismaClient,
  input: { nflSeasonYear: number; weekNumber: number; apiKey: string },
): Promise<SnapshotNflWeekOddsResult> {
  const { nflSeasonYear, weekNumber, apiKey } = input;

  const run = await prisma.oddsSnapshotRun.create({
    data: {
      nflSeasonYear,
      weekNumber,
      status: "PENDING",
      source: SOURCE_THE_ODDS_API,
    },
  });

  const games = await prisma.nflGame.findMany({
    where: { nflSeasonYear, weekNumber },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  if (games.length === 0) {
    await prisma.oddsSnapshotRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage: "No nfl_games rows for this season week — seed or import the schedule first.",
        completedAt: new Date(),
      },
    });
    return {
      ok: false,
      runId: run.id,
      code: "NO_GAMES_FOR_WEEK",
      message:
        "No NFL games in the database for this season and week. Add schedule data (e.g. seed) before snapshotting odds.",
      httpStatus: 409,
    };
  }

  let events;
  try {
    events = await fetchAmericanFootballNflOdds(apiKey);
  } catch (e) {
    const msg =
      e instanceof TheOddsApiError
        ? `${e.message}${e.bodySnippet ? ` — ${e.bodySnippet}` : ""}`
        : e instanceof Error
          ? e.message
          : "Unknown error";
    await prisma.oddsSnapshotRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage: msg,
        completedAt: new Date(),
      },
    });
    console.error(
      JSON.stringify({
        action: "odds_snapshot_failed",
        runId: run.id,
        nflSeasonYear,
        weekNumber,
        source: SOURCE_THE_ODDS_API,
        error: msg,
      }),
    );
    return {
      ok: false,
      runId: run.id,
      code: "UPSTREAM_ODDS_FAILED",
      message: msg,
      httpStatus: e instanceof TheOddsApiError && e.status >= 400 && e.status < 600 ? e.status : 502,
    };
  }

  const matched = matchTheOddsEventsToGames(
    events,
    games.map((g) => ({
      id: g.id,
      homeTeamName: g.homeTeam.name,
      awayTeamName: g.awayTeam.name,
    })),
  );

  type CompleteLine = ExtractedOddsLine & {
    homeMoneylineAmerican: number;
    awayMoneylineAmerican: number;
    homeSpreadPoints: number;
  };
  const lines: { nflGameId: string; line: CompleteLine }[] = [];
  for (const g of games) {
    const line = matched.get(g.id);
    if (line && isLineComplete(line)) {
      lines.push({ nflGameId: g.id, line });
    }
  }

  if (lines.length === 0) {
    const detail = `Provider returned ${events.length} events; none matched ${games.length} DB game(s) for nfl_season_year=${nflSeasonYear} week=${weekNumber}.`;
    await prisma.oddsSnapshotRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage: detail,
        completedAt: new Date(),
      },
    });
    console.error(
      JSON.stringify({
        action: "odds_snapshot_failed",
        runId: run.id,
        nflSeasonYear,
        weekNumber,
        source: SOURCE_THE_ODDS_API,
        error: detail,
      }),
    );
    return {
      ok: false,
      runId: run.id,
      code: "NO_MATCHING_ODDS",
      message: detail,
      httpStatus: 422,
    };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.nflGameOddsLine.createMany({
      data: lines.map(({ nflGameId, line }) => ({
        nflGameId,
        oddsSnapshotRunId: run.id,
        homeMoneylineAmerican: line.homeMoneylineAmerican,
        awayMoneylineAmerican: line.awayMoneylineAmerican,
        homeSpreadPoints: new Prisma.Decimal(line.homeSpreadPoints),
      })),
    });
    await tx.oddsSnapshotRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", completedAt: now, errorMessage: null },
    });
  });

  if (lines.length < games.length) {
    console.warn(
      JSON.stringify({
        action: "odds_snapshot_partial",
        runId: run.id,
        nflSeasonYear,
        weekNumber,
        matchedGames: lines.length,
        totalGamesInWeek: games.length,
      }),
    );
  }

  console.info(
    JSON.stringify({
      action: "odds_snapshot_completed",
      runId: run.id,
      nflSeasonYear,
      weekNumber,
      source: SOURCE_THE_ODDS_API,
      matchedGames: lines.length,
      totalGamesInWeek: games.length,
    }),
  );

  return {
    ok: true,
    runId: run.id,
    matchedGames: lines.length,
    totalGamesInWeek: games.length,
  };
}

export const ODDS_SNAPSHOT_SOURCE_MANUAL = "manual";

/**
 * Inserts a manual odds line as a new completed snapshot run (single-game patch). Merges at read time via `getEffectiveOddsLinesForWeek`.
 */
export async function upsertManualOddsLineForGame(
  prisma: PrismaClient,
  input: {
    nflGameId: string;
    homeMoneylineAmerican: number | null;
    awayMoneylineAmerican: number | null;
    homeSpreadPoints: number | null;
  },
): Promise<{ runId: string }> {
  const game = await prisma.nflGame.findUnique({
    where: { id: input.nflGameId },
    select: { nflSeasonYear: true, weekNumber: true },
  });
  if (!game) {
    throw new Error("NFL game not found");
  }

  const now = new Date();
  const run = await prisma.oddsSnapshotRun.create({
    data: {
      nflSeasonYear: game.nflSeasonYear,
      weekNumber: game.weekNumber,
      status: "COMPLETED",
      source: ODDS_SNAPSHOT_SOURCE_MANUAL,
      completedAt: now,
    },
  });

  await prisma.nflGameOddsLine.create({
    data: {
      nflGameId: input.nflGameId,
      oddsSnapshotRunId: run.id,
      homeMoneylineAmerican: input.homeMoneylineAmerican,
      awayMoneylineAmerican: input.awayMoneylineAmerican,
      homeSpreadPoints:
        input.homeSpreadPoints === null ? null : new Prisma.Decimal(input.homeSpreadPoints),
    },
  });

  console.info(
    JSON.stringify({
      action: "odds_manual_line_saved",
      runId: run.id,
      nflGameId: input.nflGameId,
      nflSeasonYear: game.nflSeasonYear,
      weekNumber: game.weekNumber,
    }),
  );

  return { runId: run.id };
}
