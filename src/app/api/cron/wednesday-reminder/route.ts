/**
 * POST `/api/cron/wednesday-reminder` — weekly Wednesday pick reminders (Story 6.5).
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron). No cookie session.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { assertCronRequest } from "@/lib/cron/assert-cron-request";
import { cronJobHttpStatus } from "@/lib/cron/cron-job-http-status";
import { isInEasternWindow } from "@/lib/cron/eastern-window";
import { getActiveLeagueIds } from "@/lib/cron/get-active-league-ids";
import { prisma } from "@/lib/db";
import {
  LeagueNotFoundError,
  NoActiveWeekError,
  getReminderData,
} from "@/lib/email/get-reminder-data";
import { sendReminder } from "@/lib/email/send-reminder";
import { logEvent } from "@/lib/logging/log-event";

/** Hobby ceiling — serial leagues + multi-member sends (Story 7.4). */
export const maxDuration = 300;

const ROUTE = "/api/cron/wednesday-reminder";

export async function POST(request: NextRequest) {
  const authError = assertCronRequest(request);
  if (authError) {
    return authError;
  }

  if (!isInEasternWindow(new Date(), 3, 19, 24)) {
    logEvent({
      level: "info",
      domain: "cron",
      route: ROUTE,
      action: "outside_window_skip",
      code: "CRON_OUTSIDE_WINDOW",
      message: "cron skipped — outside Eastern time window",
    });
    return NextResponse.json({ status: "skipped", reason: "outside_window" });
  }

  let leagueIds: string[];
  try {
    leagueIds = await getActiveLeagueIds();
  } catch (e) {
    logEvent({
      level: "error",
      domain: "cron",
      route: ROUTE,
      action: "league_error",
      message: "wednesday-reminder: failed to fetch active leagues",
      context: { error: e instanceof Error ? e.message : String(e) },
    });
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
        logEvent({
          level: "info",
          domain: "cron",
          route: ROUTE,
          action: "no_active_week",
          leagueId,
          message: "wednesday-reminder: no active week for league",
        });
      } else {
        failed++;
        logEvent({
          level: "error",
          domain: "cron",
          route: ROUTE,
          action: "league_error",
          leagueId,
          message: "wednesday-reminder: unhandled league error",
          context: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    }
    processed++;
  }

  const body = {
    processed,
    sent,
    skippedAlreadySent,
    skippedNoWeek,
    failed,
  };

  logEvent({
    level: "info",
    domain: "cron",
    route: ROUTE,
    action: "job_complete",
    message: "wednesday-reminder complete",
    context: body,
  });

  return NextResponse.json(body, { status: cronJobHttpStatus(failed) });
}

/** Vercel Cron invokes routes via GET; delegate to shared handler. */
export async function GET(request: NextRequest) {
  return POST(request);
}
