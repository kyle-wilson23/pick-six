/**
 * GET `/api/leagues/joined` — leagues the caller belongs to (**ADMIN** or **MEMBER**) (Story 2.5).
 */

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  type JoinedLeagueWithCurrentSeasonRow,
  listJoinedLeaguesWithCurrentSeason,
} from "@/lib/league/list-joined-leagues";

function serializeJoinedLeagueRow(row: JoinedLeagueWithCurrentSeasonRow) {
  return {
    id: row.league.id,
    name: row.league.name,
    role: row.role,
    createdAt: row.league.createdAt.toISOString(),
    currentSeason: row.season
      ? {
          id: row.season.id,
          nflSeasonYear: row.season.nflSeasonYear,
          firstCompetitionWeek: row.season.firstCompetitionWeek,
          firstCompetitionWeekLockedAt: row.season.firstCompetitionWeekLockedAt?.toISOString() ?? null,
          preSeasonInitializedAt: row.season.preSeasonInitializedAt?.toISOString() ?? null,
          updatedAt: row.season.updatedAt.toISOString(),
        }
      : null,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const rows = await listJoinedLeaguesWithCurrentSeason(session.user.id);
  return NextResponse.json({
    leagues: rows.map(serializeJoinedLeagueRow),
  });
}
