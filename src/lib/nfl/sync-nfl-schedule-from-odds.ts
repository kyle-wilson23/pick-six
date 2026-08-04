import type { PrismaClient } from "@prisma/client";

import { fetchAmericanFootballNflEvents, TheOddsApiError } from "@/lib/integrations/the-odds-api/client";
import { mapOddsEventsToScheduleUpserts } from "@/lib/integrations/the-odds-api/map-schedule-from-events";

export type SyncNflScheduleFromOddsResult =
  | { ok: true; upserted: number; deleted: number }
  | { ok: false; code: string; message: string; httpStatus: number };

/**
 * Full-season schedule sync from The Odds API `/events`.
 * Upserts by natural key; deletes season-year games absent from the mapped set.
 */
export async function syncNflScheduleFromOdds(
  prisma: PrismaClient,
  opts: { apiKey: string; nflSeasonYear: number },
): Promise<SyncNflScheduleFromOddsResult> {
  try {
    const events = await fetchAmericanFootballNflEvents(opts.apiKey);
    const teams = await prisma.team.findMany({ select: { id: true, abbreviation: true, name: true } });
    const mapped = mapOddsEventsToScheduleUpserts(events, opts.nflSeasonYear, teams);

    if (!mapped.ok) {
      for (const err of mapped.errors) {
        console.error(
          JSON.stringify({
            action: "nfl_schedule_odds_sync_mapping_failure",
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
        message: "No regular-season games found in Odds events for this season/year",
        httpStatus: 422,
      };
    }

    const keepKeys = new Set(
      mapped.rows.map((r) => `${r.weekNumber}|${r.homeTeamId}|${r.awayTeamId}`),
    );
    // `/events` is live/pre-match — mid-season feeds are incomplete. Only orphan-delete when
    // the mapped slate looks like a full regular season (avoids wiping completed weeks).
    const FULL_SEASON_MIN_GAMES = 200;
    const allowOrphanDelete = mapped.rows.length >= FULL_SEASON_MIN_GAMES;

    let deleted = 0;
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

      if (!allowOrphanDelete) {
        return;
      }

      const existing = await tx.nflGame.findMany({
        where: { nflSeasonYear: opts.nflSeasonYear },
        select: {
          id: true,
          weekNumber: true,
          homeTeamId: true,
          awayTeamId: true,
          status: true,
        },
      });
      const orphanIds = existing
        .filter((g) => !keepKeys.has(`${g.weekNumber}|${g.homeTeamId}|${g.awayTeamId}`))
        // Never delete finalized / in-progress games even if absent from a partial feed.
        .filter((g) => g.status === "SCHEDULED")
        .map((g) => g.id);
      if (orphanIds.length > 0) {
        const del = await tx.nflGame.deleteMany({ where: { id: { in: orphanIds } } });
        deleted = del.count;
      }
    });

    return { ok: true, upserted: mapped.rows.length, deleted };
  } catch (e) {
    if (e instanceof TheOddsApiError) {
      console.error(
        JSON.stringify({
          action: "nfl_schedule_odds_sync_provider_error",
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
    console.error(JSON.stringify({ action: "nfl_schedule_odds_sync_unexpected_error", message }));
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Unexpected error during Odds schedule sync",
      httpStatus: 500,
    };
  }
}
