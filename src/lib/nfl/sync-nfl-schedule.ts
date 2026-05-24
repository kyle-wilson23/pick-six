import type { PrismaClient } from "@prisma/client";

import { fetchNflGamesForSeason, ApiSportsNflError } from "@/lib/integrations/api-sports-nfl/client";
import { buildTeamLookup, mapApiSportsRowsToScheduleUpserts } from "@/lib/integrations/api-sports-nfl/map-schedule";

export type SyncNflScheduleResult =
  | { ok: true; upserted: number }
  | { ok: false; code: string; message: string; httpStatus: number };

/**
 * Full-season sync: one provider fetch for `nflSeasonYear`, filter regular season 1–18, upsert by natural key.
 * Updates **`kickoffAt` only** on existing rows so `NflGame.id` stays stable for odds lines (Story 3.9).
 */
export async function syncNflScheduleFromApiSports(
  prisma: PrismaClient,
  opts: { apiKey: string; nflSeasonYear: number },
): Promise<SyncNflScheduleResult> {
  try {
    const envelope = await fetchNflGamesForSeason(opts.apiKey, opts.nflSeasonYear);
    const teams = await prisma.team.findMany({ select: { id: true, abbreviation: true, name: true } });
    const lookup = buildTeamLookup(teams);
    const mapped = mapApiSportsRowsToScheduleUpserts(envelope.response, opts.nflSeasonYear, lookup);

    if (!mapped.ok) {
      for (const err of mapped.errors) {
        console.error(
          JSON.stringify({
            action: "nfl_schedule_sync_mapping_failure",
            ...err.context,
            message: err.message,
          }),
        );
      }
      const first = mapped.errors[0];
      return {
        ok: false,
        code: "SCHEDULE_MAPPING_ERROR",
        message: first?.message ?? "Schedule mapping failed",
        httpStatus: 422,
      };
    }

    if (mapped.rows.length === 0) {
      return {
        ok: false,
        code: "NO_REGULAR_SEASON_GAMES",
        message: "No regular-season games found in provider response for this season/year",
        httpStatus: 422,
      };
    }

    await prisma.$transaction(async (tx) => {
      for (const r of mapped.rows) {
        await tx.nflGame.upsert({
          where: {
            nflSeasonYear_weekNumber_homeTeamId_awayTeamId: {
              nflSeasonYear: r.nflSeasonYear,
              weekNumber: r.weekNumber,
              homeTeamId: r.homeTeamId,
              awayTeamId: r.awayTeamId,
            },
          },
          create: {
            nflSeasonYear: r.nflSeasonYear,
            weekNumber: r.weekNumber,
            homeTeamId: r.homeTeamId,
            awayTeamId: r.awayTeamId,
            kickoffAt: r.kickoffAt,
          },
          update: {
            kickoffAt: r.kickoffAt,
          },
        });
      }
    });

    return { ok: true, upserted: mapped.rows.length };
  } catch (e) {
    if (e instanceof ApiSportsNflError) {
      console.error(
        JSON.stringify({
          action: "nfl_schedule_sync_provider_error",
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
    console.error(JSON.stringify({ action: "nfl_schedule_sync_unexpected_error", message }));
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Unexpected error during schedule sync",
      httpStatus: 500,
    };
  }
}
