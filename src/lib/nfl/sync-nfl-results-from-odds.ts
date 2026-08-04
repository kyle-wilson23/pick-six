import type { NflGameStatus, PrismaClient } from "@prisma/client";

import { fetchAmericanFootballNflScores, TheOddsApiError } from "@/lib/integrations/the-odds-api/client";
import { mapOddsScoresToResultUpdates } from "@/lib/integrations/the-odds-api/map-results-from-scores";

export type SyncNflResultsFromOddsResult =
  | { ok: true; synced: number; skipped: number }
  | { ok: false; code: string; message: string; httpStatus: number };

function buildUpdateData(
  update: { status: NflGameStatus; homeScore: number; awayScore: number },
  currentStatus: NflGameStatus | undefined,
): {
  status: NflGameStatus;
  homeScore: number;
  awayScore: number;
  finalizedAt?: Date;
} {
  const data: {
    status: NflGameStatus;
    homeScore: number;
    awayScore: number;
    finalizedAt?: Date;
  } = {
    status: update.status,
    homeScore: update.homeScore,
    awayScore: update.awayScore,
  };
  if (currentStatus !== "FINAL" && update.status === "FINAL") {
    data.finalizedAt = new Date();
  }
  return data;
}

/**
 * Sync recently completed NFL scores from The Odds API (`daysFrom=3`) onto existing `NflGame` rows.
 */
export async function syncNflResultsFromOdds(
  prisma: PrismaClient,
  opts: { apiKey: string; nflSeasonYear: number; weekNumber?: number },
): Promise<SyncNflResultsFromOddsResult> {
  try {
    const events = await fetchAmericanFootballNflScores(opts.apiKey, { daysFrom: 3 });
    const teams = await prisma.team.findMany({ select: { id: true, abbreviation: true, name: true } });
    const games = await prisma.nflGame.findMany({
      where: { nflSeasonYear: opts.nflSeasonYear },
      select: {
        id: true,
        weekNumber: true,
        homeTeamId: true,
        awayTeamId: true,
        kickoffAt: true,
      },
    });

    const mapped = mapOddsScoresToResultUpdates(events, games, teams, {
      weekNumber: opts.weekNumber,
    });

    for (const err of mapped.errors) {
      console.error(
        JSON.stringify({
          action: "nfl_results_odds_sync_match_failure",
          ...err.context,
          message: err.message,
        }),
      );
    }

    // No completed games yet (all live/upcoming) is a no-op success, not a hard failure.
    if (mapped.updates.length === 0) {
      return { ok: true, synced: 0, skipped: mapped.errors.length };
    }

    let synced = 0;
    const skipped = mapped.errors.length;

    await prisma.$transaction(async (tx) => {
      for (const update of mapped.updates) {
        const existing = await tx.nflGame.findUnique({
          where: { id: update.nflGameId },
          select: { id: true, status: true },
        });
        if (!existing) {
          continue;
        }
        await tx.nflGame.update({
          where: { id: existing.id },
          data: buildUpdateData(update, existing.status),
        });
        synced += 1;
      }
    });

    return { ok: true, synced, skipped };
  } catch (e) {
    if (e instanceof TheOddsApiError) {
      console.error(
        JSON.stringify({
          action: "nfl_results_odds_sync_provider_error",
          message: e.message,
          httpStatus: e.status,
        }),
      );
      return {
        ok: false,
        code: "PROVIDER_ERROR",
        message: e.message,
        httpStatus: e.status >= 400 && e.status < 600 ? e.status : 502,
      };
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(JSON.stringify({ action: "nfl_results_odds_sync_unexpected_error", message }));
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Unexpected error during Odds results sync",
      httpStatus: 500,
    };
  }
}
