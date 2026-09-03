import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { assertCronRequest } from "@/lib/cron/assert-cron-request";
import { cronJobHttpStatus } from "@/lib/cron/cron-job-http-status";
import { runReminderTick, type ReminderTickResult } from "@/lib/cron/run-reminder-tick";
import { logEvent } from "@/lib/logging/log-event";

/** Auth + shared loop + JSON. Both daily tick routes are thin wrappers around this. */
export async function reminderTickPost(
  request: NextRequest,
  route: string,
): Promise<NextResponse> {
  const authError = assertCronRequest(request);
  if (authError) {
    return authError;
  }

  let body: ReminderTickResult;
  try {
    body = await runReminderTick({ route });
  } catch (e) {
    logEvent({
      level: "error",
      domain: "cron",
      route,
      action: "league_error",
      message: "reminder tick: failed to fetch active leagues",
      context: { error: e instanceof Error ? e.message : String(e) },
    });
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Failed to fetch active leagues" } },
      { status: 500 },
    );
  }

  logEvent({
    level: "info",
    domain: "cron",
    route,
    action: "job_complete",
    message: "reminder tick complete",
    context: body,
  });

  return NextResponse.json(body, { status: cronJobHttpStatus(body.failed) });
}
