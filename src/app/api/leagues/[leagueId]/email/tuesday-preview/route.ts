/**
 * GET `/api/leagues/[leagueId]/email/tuesday-preview` — render Tuesday digest HTML (Story 6.2).
 */

import { LeagueMembershipRole } from "@prisma/client";
import { render } from "@react-email/components";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createElement } from "react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  LeagueNotFoundError,
  NoActiveWeekError,
  getTuesdayDigestData,
} from "@/lib/email/get-tuesday-digest-data";
import { TuesdayDigestEmail } from "@/lib/email/templates/TuesdayDigestEmail";

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
      select: { bodyText: true },
    });

    const html = await render(
      createElement(TuesdayDigestEmail, {
        leagueName: data.leagueName,
        weekNumber: data.weekNumber,
        standings: data.standings.map((s) => ({
          rank: s.rank,
          displayName: s.displayName,
          totalPoints: s.totalPoints,
          wins: s.wins,
          losses: s.losses,
        })),
        jailedTeamName: data.jailedTeamName,
        jailedTeamAbbreviation: data.jailedTeamAbbreviation,
        picksUrl: data.picksUrl,
        adminNote: config?.bodyText ?? null,
      }),
    );

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
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
    console.error("GET /api/leagues/[leagueId]/email/tuesday-preview failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
