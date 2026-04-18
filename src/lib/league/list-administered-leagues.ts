import { LeagueMembershipRole } from "@prisma/client";

import { prisma } from "@/lib/db";

import { getCurrentNflSeasonYear } from "./nfl-season";

export type AdministeredLeagueWithSeasonRow = {
  league: {
    id: string;
    name: string;
    createdAt: Date;
  };
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

export function toAdministeredLeagueRows(
  leagues: LeagueWithCurrentSeasonChunk[],
): AdministeredLeagueWithSeasonRow[] {
  return leagues.map((league) => ({
    league: {
      id: league.id,
      name: league.name,
      createdAt: league.createdAt,
    },
    season: league.seasons[0] ?? null,
  }));
}

/**
 * Leagues the user administers, with the current NFL season row when present (Story 2.4).
 * Sorted by league name ascending.
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
    orderBy: { league: { name: "asc" } },
  });

  return toAdministeredLeagueRows(memberships.map((m) => m.league));
}
