/**
 * GET/POST `/api/cron/sync-nfl-results` — Odds `/scores` (`daysFrom=3`) → canonical `NflGame`.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron). No cookie session.
 * Hobby: fires Wednesday UTC; Eastern window gates ±1h drift.
 * Ops: provider lookback is max 3 days — missed Wed run needs admin sync-results override.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { assertCronRequest } from "@/lib/cron/assert-cron-request";
import { isInEasternWindow } from "@/lib/cron/eastern-window";
import { prisma } from "@/lib/db";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { logEvent } from "@/lib/logging/log-event";
import { syncNflResultsFromOdds } from "@/lib/nfl/sync-nfl-results-from-odds";

/** Hobby ceiling. */
export const maxDuration = 300;

const ROUTE = "/api/cron/sync-nfl-results";

/** Wed 11:00–17:00 ET (matches vercel `0 16 * * 3` ~12 PM ET). */
const ET_DAY = 3;
const ET_START = 11;
const ET_END = 17;

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
  // No weekNumber — finalize all completed scores in the provider's 3-day lookback.
  const result = await syncNflResultsFromOdds(prisma, { apiKey, nflSeasonYear });

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
    weekNumber: null as null,
    synced: result.synced,
    skipped: result.skipped,
    provider: "the-odds-api" as const,
  };

  logEvent({
    level: "info",
    domain: "cron",
    route: ROUTE,
    action: "job_complete",
    message: "sync-nfl-results complete",
    context: body,
  });

  return NextResponse.json(body);
}

/** Vercel Cron invokes routes via GET; delegate to shared handler. */
export async function GET(request: NextRequest) {
  return POST(request);
}
