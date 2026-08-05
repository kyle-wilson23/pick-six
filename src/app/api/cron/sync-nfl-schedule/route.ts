/**
 * GET/POST `/api/cron/sync-nfl-schedule` — weekly Odds `/events` → canonical `NflGame`.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron). No cookie session.
 * Hobby: fires Monday UTC; Eastern window gates ±1h drift.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { assertCronRequest } from "@/lib/cron/assert-cron-request";
import { isInEasternWindow } from "@/lib/cron/eastern-window";
import { prisma } from "@/lib/db";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { logEvent } from "@/lib/logging/log-event";
import { syncNflScheduleFromOdds } from "@/lib/nfl/sync-nfl-schedule-from-odds";

/** Hobby ceiling. */
export const maxDuration = 300;

const ROUTE = "/api/cron/sync-nfl-schedule";

/** Mon 10:00–16:00 ET (matches vercel `0 15 * * 1` ~11 AM ET). */
const ET_DAY = 1;
const ET_START = 10;
const ET_END = 16;

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
  const result = await syncNflScheduleFromOdds(prisma, { apiKey, nflSeasonYear });

  if (!result.ok) {
    logEvent({
      level: "error",
      domain: "cron",
      route: ROUTE,
      action: "sync_failed",
      code: result.code,
      message: result.message,
      context: { nflSeasonYear, httpStatus: result.httpStatus },
    });
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: result.httpStatus },
    );
  }

  const body = {
    nflSeasonYear,
    upserted: result.upserted,
    deleted: result.deleted,
    provider: "the-odds-api" as const,
  };

  logEvent({
    level: "info",
    domain: "cron",
    route: ROUTE,
    action: "job_complete",
    message: "sync-nfl-schedule complete",
    context: body,
  });

  return NextResponse.json(body);
}

/** Vercel Cron invokes routes via GET; delegate to shared handler. */
export async function GET(request: NextRequest) {
  return POST(request);
}
