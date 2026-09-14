/**
 * GET/POST `/api/cron/week-close` — Tuesday ~7am ET: results → finalize closed week →
 * odds snapshot → global jailed for the opening week.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron). No cookie session.
 * Hobby: fires Tuesday 11:00 UTC; Eastern window gates ±1h drift + DST.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { assertCronRequest } from "@/lib/cron/assert-cron-request";
import { isInEasternWindow } from "@/lib/cron/eastern-window";
import { firstHardFailure, runWeekClose } from "@/lib/cron/run-week-close";
import { prisma } from "@/lib/db";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { logEvent } from "@/lib/logging/log-event";

/** Hobby ceiling. */
export const maxDuration = 300;

const ROUTE = "/api/cron/week-close";

/** Tue 5:00–11:00 ET (matches vercel `0 11 * * 2` ~7am EDT / 6am EST). */
const ET_DAY = 2;
const ET_START = 5;
const ET_END = 11;

export async function POST(request: NextRequest) {
  const authError = assertCronRequest(request);
  if (authError) {
    return authError;
  }

  if (!isInEasternWindow(new Date(), ET_DAY, ET_START, ET_END)) {
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

  const apiKey = process.env.ODDS_API_KEY?.trim();
  if (!apiKey) {
    logEvent({
      level: "error",
      domain: "cron",
      route: ROUTE,
      action: "missing_odds_api_key",
      code: "ODDS_API_NOT_CONFIGURED",
      message: "ODDS_API_KEY is not set on the server",
    });
    return NextResponse.json(
      {
        error: {
          code: "ODDS_API_NOT_CONFIGURED",
          message: "ODDS_API_KEY is not set on the server",
        },
      },
      { status: 503 },
    );
  }

  const nflSeasonYear = getCurrentNflSeasonYear();
  const result = await runWeekClose(prisma, { apiKey, nflSeasonYear });

  logEvent({
    level: result.ok ? "info" : "error",
    domain: "cron",
    route: ROUTE,
    action: result.ok ? "job_complete" : "week_close_failed",
    code: result.ok ? undefined : "WEEK_CLOSE_FAILED",
    message: result.ok ? "week-close complete" : "week-close completed with hard step failure",
    context: {
      nflSeasonYear: result.nflSeasonYear,
      closedWeek: result.closedWeek,
      snapshotWeek: result.snapshotWeek,
      httpStatus: result.httpStatus,
      failedCode: firstHardFailure(result)?.code,
    },
  });

  if (!result.ok) {
    const failed = firstHardFailure(result);
    return NextResponse.json(
      {
        error: {
          code: failed?.code ?? "WEEK_CLOSE_FAILED",
          message: failed?.message ?? "week-close completed with hard step failure",
        },
        ...result,
      },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json(result);
}

/** Vercel Cron invokes routes via GET; delegate to shared handler. */
export async function GET(request: NextRequest) {
  return POST(request);
}
