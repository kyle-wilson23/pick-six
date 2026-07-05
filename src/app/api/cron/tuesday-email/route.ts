/**
 * POST `/api/cron/tuesday-email` — weekly Tuesday digest for all active leagues (Story 6.5).
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron). No cookie session.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { assertCronRequest } from "@/lib/cron/assert-cron-request";
import { isInEasternWindow } from "@/lib/cron/eastern-window";
import { getActiveLeagueIds } from "@/lib/cron/get-active-league-ids";
import { prisma } from "@/lib/db";
import {
  LeagueNotFoundError,
  NoActiveWeekError,
  getTuesdayDigestData,
} from "@/lib/email/get-tuesday-digest-data";
import { sendTuesdayDigest } from "@/lib/email/send-tuesday-digest";

export async function POST(request: NextRequest) {
  const authError = assertCronRequest(request);
  if (authError) {
    return authError;
  }

  if (!isInEasternWindow(new Date(), 2, 17, 21)) {
    return NextResponse.json({ status: "skipped", reason: "outside_window" });
  }

  let leagueIds: string[];
  try {
    leagueIds = await getActiveLeagueIds();
  } catch (e) {
    console.error("[cron] tuesday-email: failed to fetch active leagues", { error: e });
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Failed to fetch active leagues" } },
      { status: 500 },
    );
  }

  let processed = 0;
  let sent = 0;
  let skippedAlreadySent = 0;
  let skippedNoWeek = 0;
  let failed = 0;

  for (const leagueId of leagueIds) {
    try {
      const data = await getTuesdayDigestData({ leagueId });

      const existing = await prisma.leagueWeekEmailConfig.findUnique({
        where: {
          leagueId_nflSeasonYear_weekNumber: {
            leagueId,
            nflSeasonYear: data.nflSeasonYear,
            weekNumber: data.weekNumber,
          },
        },
        select: { sentAt: true },
      });

      if (existing?.sentAt != null) {
        skippedAlreadySent++;
        processed++;
        continue;
      }

      const result = await sendTuesdayDigest({ leagueId, preloadedData: data });
      sent += result.sent;
      failed += result.failed;
    } catch (e) {
      if (e instanceof NoActiveWeekError || e instanceof LeagueNotFoundError) {
        skippedNoWeek++;
        console.info("[cron] tuesday-email: no active week for league", { leagueId });
      } else {
        failed++;
        console.error("[cron] tuesday-email: unhandled league error", { leagueId, error: e });
      }
    }
    processed++;
  }

  console.info("[cron] tuesday-email complete", {
    processed,
    sent,
    skippedAlreadySent,
    skippedNoWeek,
    failed,
  });

  return NextResponse.json({
    processed,
    sent,
    skippedAlreadySent,
    skippedNoWeek,
    failed,
  });
}

/** Vercel Cron invokes routes via GET; delegate to shared handler. */
export async function GET(request: NextRequest) {
  return POST(request);
}
