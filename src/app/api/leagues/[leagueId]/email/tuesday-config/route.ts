/**
 * GET/PUT `/api/leagues/[leagueId]/email/tuesday-config` — Tuesday digest email config (Story 6.2).
 *
 * - **CSRF / same-origin:** PUT reads JSON first, then `assertCookieSessionMutationOrigin` (NFR15).
 */

import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import {
  LeagueNotFoundError,
  NoActiveWeekError,
  getTuesdayDigestData,
} from "@/lib/email/get-tuesday-digest-data";

async function requireAdmin(leagueId: string, userId: string) {
  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
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

  return null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ leagueId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const { leagueId } = await context.params;
  const forbidden = await requireAdmin(leagueId, session.user.id);
  if (forbidden) {
    return forbidden;
  }

  try {
    const data = await getTuesdayDigestData({ leagueId });
    const config = await prisma.leagueWeekEmailConfig.findUnique({
      where: {
        leagueId_nflSeasonYear_weekNumber: {
          leagueId,
          nflSeasonYear: data.nflSeasonYear,
          weekNumber: data.weekNumber,
        },
      },
      select: {
        bodyText: true,
        sentAt: true,
        wednesdayReminderSentAt: true,
        thursdayReminderSentAt: true,
      },
    });

    return NextResponse.json({
      weekNumber: data.weekNumber,
      bodyText: config?.bodyText ?? null,
      sentAt: config?.sentAt?.toISOString() ?? null,
      wednesdayReminderSentAt: config?.wednesdayReminderSentAt?.toISOString() ?? null,
      thursdayReminderSentAt: config?.thursdayReminderSentAt?.toISOString() ?? null,
    });
  } catch (e) {
    if (e instanceof NoActiveWeekError) {
      return NextResponse.json({
        weekNumber: null,
        bodyText: null,
        sentAt: null,
        wednesdayReminderSentAt: null,
        thursdayReminderSentAt: null,
      });
    }
    if (e instanceof LeagueNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "League not found" } },
        { status: 404 },
      );
    }
    console.error("GET /api/leagues/[leagueId]/email/tuesday-config failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}

const putBodySchema = z.object({
  weekNumber: z.number().int().min(1).max(18),
  bodyText: z.string().max(2000).nullable(),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ leagueId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const { leagueId } = await context.params;
  const forbidden = await requireAdmin(leagueId, session.user.id);
  if (forbidden) {
    return forbidden;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const parsed = putBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const csrfError = assertCookieSessionMutationOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  try {
    const data = await getTuesdayDigestData({ leagueId });

    if (parsed.data.weekNumber !== data.weekNumber) {
      return NextResponse.json(
        {
          error: {
            code: "WEEK_MISMATCH",
            message: `Active week is ${data.weekNumber}, not ${parsed.data.weekNumber}`,
          },
        },
        { status: 409 },
      );
    }

    const row = await prisma.leagueWeekEmailConfig.upsert({
      where: {
        leagueId_nflSeasonYear_weekNumber: {
          leagueId,
          nflSeasonYear: data.nflSeasonYear,
          weekNumber: data.weekNumber,
        },
      },
      create: {
        leagueId,
        nflSeasonYear: data.nflSeasonYear,
        weekNumber: data.weekNumber,
        bodyText: parsed.data.bodyText,
      },
      update: {
        bodyText: parsed.data.bodyText,
      },
      select: { bodyText: true, sentAt: true },
    });

    return NextResponse.json({
      weekNumber: data.weekNumber,
      bodyText: row.bodyText,
      sentAt: row.sentAt?.toISOString() ?? null,
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
    console.error("PUT /api/leagues/[leagueId]/email/tuesday-config failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
