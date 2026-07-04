/**
 * POST `/api/leagues/[leagueId]/email/wednesday-reminder` — send Wednesday pick reminders (Story 6.3).
 *
 * - **CSRF / same-origin:** `assertCookieSessionMutationOrigin` before `auth()` (NFR15).
 */

import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
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

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });

  if (!membership) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required for this league" } },
      { status: 403 },
    );
  }

  if (membership.role !== LeagueMembershipRole.ADMIN) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required for this league" } },
      { status: 403 },
    );
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
            message: "Wednesday reminder already sent for this week",
          },
        },
        { status: 409 },
      );
    }

    const result = await sendReminder({
      leagueId,
      reminderType: "wednesday",
      preloadedData: data,
    });

    return NextResponse.json({
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      sentAt: result.sentAt?.toISOString() ?? null,
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
