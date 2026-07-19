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
import { formatEmailSubject } from "@/lib/email/test-league-labeling";
import { TuesdayDigestEmail } from "@/lib/email/templates/TuesdayDigestEmail";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** HTTP header values are ByteStrings — strip control chars / non-Latin-1 so a league name can never break header construction. */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\0]/g, "").replace(/[^\x20-\x7E]/g, "");
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
        isTestLeague: data.isTestLeague,
      }),
    );

    // Inject subject so admins see the same labeling participants get (AC5).
    const subject = formatEmailSubject(
      `[${data.leagueName}] Week ${data.weekNumber} — Tuesday Update`,
      data.isTestLeague,
    );
    const subjectBanner = `<p style="font-family:sans-serif;margin:16px;padding:12px;background:#f5f5f5;border-radius:4px"><strong>Subject:</strong> ${escapeHtml(subject)}</p>`;
    // Use a replacer function (not a template string) so literal `$`-sequences in the
    // league name/subject can never be reinterpreted as replace() backreferences.
    const previewHtml = /<body[^>]*>/i.test(html)
      ? html.replace(/<body([^>]*)>/i, (_match, attrs: string) => `<body${attrs}>${subjectBanner}`)
      : `${subjectBanner}${html}`;

    return new Response(previewHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Email-Subject": sanitizeHeaderValue(subject),
      },
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
