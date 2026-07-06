/**
 * GET `/api/leagues/[leagueId]/export` — admin CSV export of full league snapshot (Story 7.1).
 *
 * Read-only; no CSRF. Admin league membership required.
 */

import "server-only";

import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { buildLeagueExportData } from "@/lib/export/build-league-export-data";
import { sanitizeDownloadFilenameSegment } from "@/lib/export/sanitize-download-filename";
import { serializeLeagueExportCsv } from "@/lib/export/serialize-league-export-csv";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";

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

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true },
  });

  if (!league) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "League not found" } },
      { status: 404 },
    );
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });

  if (!membership || membership.role !== LeagueMembershipRole.ADMIN) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required for this league" } },
      { status: 403 },
    );
  }

  try {
    const nflSeasonYear = getCurrentNflSeasonYear();
    const data = await buildLeagueExportData(prisma, { leagueId, nflSeasonYear });
    const csv = serializeLeagueExportCsv(data);
    const filenameSegment = sanitizeDownloadFilenameSegment(league.name);
    const filename = `${filenameSegment}-${nflSeasonYear}-export.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("GET /api/leagues/[leagueId]/export failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
