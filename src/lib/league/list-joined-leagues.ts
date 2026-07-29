import type { LeagueMembershipRole } from "@prisma/client";

import { prisma } from "@/lib/db";

import {
  type LeagueWithCurrentSeasonChunk,
  toAdministeredLeagueRows,
} from "./list-administered-leagues";
import { getCurrentNflSeasonYear } from "./nfl-season";
import { sortLeaguesByRecentVisit } from "./sort-leagues-by-recent-visit";

export type JoinedLeagueWithCurrentSeasonRow = {
  league: { id: string; name: string; isTestLeague: boolean; createdAt: Date };
  role: LeagueMembershipRole;
  lastVisitedAt: Date | null;
  season: null | {
    id: string;
    nflSeasonYear: number;
    firstCompetitionWeek: number;
    firstCompetitionWeekLockedAt: Date | null;
    preSeasonInitializedAt: Date | null;
    updatedAt: Date;
  };
};

export function mapMembershipsToJoinedRows(
  memberships: Array<{
    role: LeagueMembershipRole;
    lastVisitedAt: Date | null;
    league: LeagueWithCurrentSeasonChunk;
  }>,
): JoinedLeagueWithCurrentSeasonRow[] {
  const rows = memberships.map((m) => {
    const [row] = toAdministeredLeagueRows([m.league]);
    return {
      league: row.league,
      role: m.role,
      lastVisitedAt: m.lastVisitedAt,
      season: row.season,
    };
  });
  return sortLeaguesByRecentVisit(rows);
}

/**
 * Leagues the user belongs to (**ADMIN** or **MEMBER**), with the current NFL season row when
 * present (Story 2.5). Sorted by most recently visited, then name (Story 9.5). Both roles are
 * participant roles for authorization (`isLeagueParticipantRole` in Story 2.6); do not filter to **MEMBER** only here.
 */
export async function listJoinedLeaguesWithCurrentSeason(
  userId: string,
  nflSeasonYear: number = getCurrentNflSeasonYear(),
): Promise<JoinedLeagueWithCurrentSeasonRow[]> {
  const memberships = await prisma.leagueMembership.findMany({
    where: { userId },
    include: {
      league: {
        include: {
          seasons: {
            where: { nflSeasonYear },
            take: 1,
          },
        },
      },
    },
  });

  return mapMembershipsToJoinedRows(memberships);
}

export { describeSeasonForParticipant } from "./describe-season-for-participant";
