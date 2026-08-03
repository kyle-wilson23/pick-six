import { LeagueMembershipRole } from "@prisma/client";

import { prisma } from "@/lib/db";

import { getCurrentNflSeasonYear } from "./nfl-season";
import { sortLeaguesByRecentVisit } from "./sort-leagues-by-recent-visit";

export type AdministeredLeagueWithSeasonRow = {
  league: {
    id: string;
    name: string;
    isTestLeague: boolean;
    createdAt: Date;
  };
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

/** Shape of `league` + nested `seasons` slice from `listAdministeredLeaguesWithCurrentSeason` query. */
export type LeagueWithCurrentSeasonChunk = {
  id: string;
  name: string;
  isTestLeague: boolean;
  createdAt: Date;
  seasons: Array<{
    id: string;
    nflSeasonYear: number;
    firstCompetitionWeek: number;
    firstCompetitionWeekLockedAt: Date | null;
    preSeasonInitializedAt: Date | null;
    updatedAt: Date;
  }>;
};

/** Maps league + season slice only; callers attach `lastVisitedAt` from membership. */
export function toAdministeredLeagueRows(
  leagues: LeagueWithCurrentSeasonChunk[],
): Omit<AdministeredLeagueWithSeasonRow, "lastVisitedAt">[] {
  return leagues.map((league) => ({
    league: {
      id: league.id,
      name: league.name,
      isTestLeague: league.isTestLeague,
      createdAt: league.createdAt,
    },
    season: league.seasons[0] ?? null,
  }));
}

/**
 * Leagues the user administers, with the current NFL season row when present (Story 2.4).
 * Sorted by most recently visited, then name (Story 9.5).
 */
export async function listAdministeredLeaguesWithCurrentSeason(
  userId: string,
  nflSeasonYear: number = getCurrentNflSeasonYear(),
): Promise<AdministeredLeagueWithSeasonRow[]> {
  const memberships = await prisma.leagueMembership.findMany({
    where: { userId, role: LeagueMembershipRole.ADMIN },
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

  const rows = memberships.map((m) => {
    const [row] = toAdministeredLeagueRows([m.league]);
    return {
      ...row,
      lastVisitedAt: m.lastVisitedAt,
    };
  });

  return sortLeaguesByRecentVisit(rows);
}
