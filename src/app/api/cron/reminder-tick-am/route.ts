/**
 * GET/POST `/api/cron/reminder-tick-am` — morning reminder tick (07:00 EDT / 06:00 EST).
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron). No cookie session.
 * Both ticks evaluate both deadline-anchored slots; this route does not imply a weekday.
 */

import type { NextRequest } from "next/server";

import { reminderTickPost } from "@/lib/cron/reminder-tick-http";

/** Hobby ceiling — serial leagues + multi-member sends (Story 7.4). */
export const maxDuration = 300;

const ROUTE = "/api/cron/reminder-tick-am";

export async function POST(request: NextRequest) {
  return reminderTickPost(request, ROUTE);
}

/** Vercel Cron invokes routes via GET; delegate to shared handler. */
export async function GET(request: NextRequest) {
  return POST(request);
}
