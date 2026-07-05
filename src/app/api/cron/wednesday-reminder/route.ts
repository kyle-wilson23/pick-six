/**
 * POST `/api/cron/wednesday-reminder` — weekly Wednesday pick reminders (Story 6.5).
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
  getReminderData,
} from "@/lib/email/get-reminder-data";
import { sendReminder } from "@/lib/email/send-reminder";

export async function POST(request: NextRequest) {
  const authError = assertCronRequest(request);
  if (authError) {
    return authError;
  }

  if (!isInEasternWindow(new Date(), 3, 19, 24)) {
    return NextResponse.json({ status: "skipped", reason: "outside_window" });
  }

  let leagueIds: string[];
  try {
    leagueIds = await getActiveLeagueIds();
  } catch (e) {
    console.error("[cron] wednesday-reminder: failed to fetch active leagues", { error: e });
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
      const data = await getReminderData({ leagueId });

      const existing = await prisma.leagueWeekEmailConfig.findUnique({
        where: {
          leagueId_nflSeasonYear_weekNumber: {
            leagueId,
            nflSeasonYear: data.nflSeasonYear,
            weekNumber: data.weekNumber,
          },
        },
        select: { wednesdayReminderSentAt: true },
      });

      if (existing?.wednesdayReminderSentAt != null) {
        skippedAlreadySent++;
        processed++;
        continue;
      }

      const result = await sendReminder({
        leagueId,
        reminderType: "wednesday",
        preloadedData: data,
      });
      sent += result.sent;
      failed += result.failed;
    } catch (e) {
      if (e instanceof NoActiveWeekError || e instanceof LeagueNotFoundError) {
        skippedNoWeek++;
        console.info("[cron] wednesday-reminder: no active week for league", { leagueId });
      } else {
        failed++;
        console.error("[cron] wednesday-reminder: unhandled league error", { leagueId, error: e });
      }
    }
    processed++;
  }

  console.info("[cron] wednesday-reminder complete", {
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
