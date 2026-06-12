import type { NflGameStatus, PrismaClient } from "@prisma/client";

import { fetchNflGamesForSeason, ApiSportsNflError } from "@/lib/integrations/api-sports-nfl/client";
import { buildTeamLookup } from "@/lib/integrations/api-sports-nfl/map-schedule";
import {
  mapApiSportsRowsToResultUpdates,
  weeksWithCompletedGames,
  type NflGameResultUpdate,
} from "@/lib/integrations/api-sports-nfl/map-results";

export type SyncNflResultsResult =
  | { ok: true; synced: number; skipped: number }
  | { ok: false; code: string; message: string; httpStatus: number };

function buildUpdateData(
  update: NflGameResultUpdate,
  currentStatus: NflGameStatus | undefined,
): {
  status: NflGameStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  finalizedAt?: Date;
} {
  const data: {
    status: NflGameStatus;
    homeScore?: number | null;
    awayScore?: number | null;
    finalizedAt?: Date;
  } = { status: update.status };

  if (update.homeScore !== undefined) {
    data.homeScore = update.homeScore;
  }
  if (update.awayScore !== undefined) {
    data.awayScore = update.awayScore;
  }

  const shouldSetFinalizedAt = currentStatus !== "FINAL" && update.status === "FINAL";
  if (shouldSetFinalizedAt) {
    data.finalizedAt = new Date();
  }

  return data;
}

/**
 * Sync game results from API-Sports for a season (optional single week).
 * Reuses full-season `/games` fetch; filters client-side when `weekNumber` is set.
 */
export async function syncNflResultsFromApiSports(
  prisma: PrismaClient,
  opts: { apiKey: string; nflSeasonYear: number; weekNumber?: number },
): Promise<SyncNflResultsResult> {
  try {
    const envelope = await fetchNflGamesForSeason(opts.apiKey, opts.nflSeasonYear);
    const teams = await prisma.team.findMany({ select: { id: true, abbreviation: true, name: true } });
    const lookup = buildTeamLookup(teams);

    const completedWeeks =
      opts.weekNumber != null ? new Set([opts.weekNumber]) : weeksWithCompletedGames(envelope.response);

    const mapped = mapApiSportsRowsToResultUpdates(envelope.response, opts.nflSeasonYear, lookup, {
      weekNumber: opts.weekNumber,
    });

    for (const err of mapped.errors) {
      console.error(
        JSON.stringify({
          action: "nfl_results_sync_match_failure",
          ...err.context,
          message: err.message,
        }),
      );
    }

    const updatesToApply =
      opts.weekNumber != null
        ? mapped.updates
        : mapped.updates.filter((u) => completedWeeks.has(u.weekNumber));

    if (updatesToApply.length === 0 && mapped.errors.length === 0) {
      return {
        ok: false,
        code: "NO_GAMES_TO_SYNC",
        message: "No games found to sync for the requested season/week scope",
        httpStatus: 422,
      };
    }

    let synced = 0;
    let skipped = mapped.errors.length;

    await prisma.$transaction(async (tx) => {
      for (const update of updatesToApply) {
        const existing = await tx.nflGame.findUnique({
          where: {
            nflSeasonYear_weekNumber_homeTeamId_awayTeamId: {
              nflSeasonYear: update.nflSeasonYear,
              weekNumber: update.weekNumber,
              homeTeamId: update.homeTeamId,
              awayTeamId: update.awayTeamId,
            },
          },
          select: { id: true, status: true },
        });

        if (!existing) {
          skipped += 1;
          console.error(
            JSON.stringify({
              action: "nfl_results_sync_match_failure",
              message: "no_matching_nfl_game",
              nflSeasonYear: update.nflSeasonYear,
              weekNumber: update.weekNumber,
              homeTeamId: update.homeTeamId,
              awayTeamId: update.awayTeamId,
            }),
          );
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
    if (e instanceof ApiSportsNflError) {
      console.error(
        JSON.stringify({
          action: "nfl_results_sync_provider_error",
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
    console.error(JSON.stringify({ action: "nfl_results_sync_unexpected_error", message }));
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Unexpected error during results sync",
      httpStatus: 500,
    };
  }
}
