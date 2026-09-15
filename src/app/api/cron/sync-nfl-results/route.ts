/**
 * GET/POST `/api/cron/sync-nfl-results` — Odds `/scores` (`daysFrom=3`) → canonical `NflGame`.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron). No cookie session.
 * Hobby: fires Wednesday and Saturday UTC; Eastern window gates ±1h drift.
 * Ops: provider lookback is max 3 days — Saturday persists TNF before Tuesday ages it out.
 * Wednesday also `finalizeNflWeek` for the closed week (late MNF catch-up). Saturday syncs only.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { assertCronRequest } from "@/lib/cron/assert-cron-request";
import { resolveNflResultsCronWindow } from "@/lib/cron/nfl-results-cron-window";
import { finalizeClosedWeekAfterResultsSync } from "@/lib/cron/run-week-close";
import { prisma } from "@/lib/db";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { logEvent } from "@/lib/logging/log-event";
import { syncNflResultsFromOdds } from "@/lib/nfl/sync-nfl-results-from-odds";

/** Hobby ceiling. */
export const maxDuration = 300;

const ROUTE = "/api/cron/sync-nfl-results";

export async function POST(request: NextRequest) {
  const authError = assertCronRequest(request);
  if (authError) {
    return authError;
  }

  const window = resolveNflResultsCronWindow(new Date());
  if (!window.inWindow) {
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

  const catchUp = window.shouldFinalizeClosedWeek
    ? await finalizeClosedWeekAfterResultsSync(prisma, nflSeasonYear)
    : {
        closedWeek: null,
        finalize: { skipped: true as const, reason: "saturday_no_finalize" as const },
      };
  if ("ok" in catchUp.finalize && catchUp.finalize.ok === false) {
    logEvent({
      level: "error",
      domain: "cron",
      route: ROUTE,
      action: "finalize_failed",
      code: catchUp.finalize.code,
      message: catchUp.finalize.message,
      context: {
        nflSeasonYear,
        closedWeek: catchUp.closedWeek,
        httpStatus: catchUp.finalize.httpStatus,
      },
    });
    return NextResponse.json(
      { error: { code: catchUp.finalize.code, message: catchUp.finalize.message } },
      { status: catchUp.finalize.httpStatus },
    );
  }

  const body = {
    nflSeasonYear,
    weekNumber: null as null,
    synced: result.synced,
    skipped: result.skipped,
    provider: "the-odds-api" as const,
    closedWeek: catchUp.closedWeek,
    finalize: catchUp.finalize,
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
