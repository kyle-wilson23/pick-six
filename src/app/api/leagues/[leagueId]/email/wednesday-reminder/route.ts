/**
 * POST `/api/leagues/[leagueId]/email/wednesday-reminder` — send the first (slot 1) pick reminder.
 *
 * URL is historical; this is the `deadline − 48h` reminder, not a Wednesday-only send.
 * Admin manual send is not gated on the deadline (submit-on-behalf remains the post-deadline valve).
 *
 * - **CSRF / same-origin:** `assertCookieSessionMutationOrigin` before `auth()` (NFR15).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { forbiddenAdminJson, requireLeagueAdminAccess } from "@/lib/league/require-league-admin";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import {
  LeagueNotFoundError,
  NoActiveWeekError,
  getReminderData,
} from "@/lib/email/get-reminder-data";
import { sendReminder } from "@/lib/email/send-reminder";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leagueId: string }> },
) {
  const csrfError = assertCookieSessionMutationOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const { leagueId } = await context.params;

  const access = await requireLeagueAdminAccess(session.user.id, leagueId);
  if (!access) {
    return forbiddenAdminJson();
  }

  const force = request.nextUrl.searchParams.get("force") === "true";

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

    if (existing?.wednesdayReminderSentAt != null && !force) {
      return NextResponse.json(
        {
          error: {
            code: "ALREADY_SENT",
            message: "First reminder already sent for this week",
          },
        },
        { status: 409 },
      );
    }

    const result = await sendReminder({
      leagueId,
      slot: 1,
      preloadedData: data,
    });

    return NextResponse.json({
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      sentAt: result.sentAt?.toISOString() ?? null,
      suppressed: result.suppressed,
      wouldSendCount: result.wouldSendCount,
    });
  } catch (e) {
    if (e instanceof NoActiveWeekError) {
      return NextResponse.json(
        { error: { code: "NO_ACTIVE_WEEK", message: "No active week for email" } },
        { status: 409 },
      );
    }
    if (e instanceof LeagueNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "League not found" } },
        { status: 404 },
      );
    }
    console.error("POST /api/leagues/[leagueId]/email/wednesday-reminder failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
