import type { LeagueMembershipRole } from "@prisma/client";

import { prisma } from "@/lib/db";

import {
  type LeagueWithCurrentSeasonChunk,
  toAdministeredLeagueRows,
} from "./list-administered-leagues";
import { getCurrentNflSeasonYear } from "./nfl-season";

export type JoinedLeagueWithCurrentSeasonRow = {
  league: { id: string; name: string; createdAt: Date };
  role: LeagueMembershipRole;
  season: null | {
    id: string;
    nflSeasonYear: number;
    firstCompetitionWeek: number;
    preSeasonInitializedAt: Date | null;
    updatedAt: Date;
  };
};

export function mapMembershipsToJoinedRows(
  memberships: Array<{ role: LeagueMembershipRole; league: LeagueWithCurrentSeasonChunk }>,
): JoinedLeagueWithCurrentSeasonRow[] {
  return memberships.map((m) => {
    const [row] = toAdministeredLeagueRows([m.league]);
    return {
      league: row.league,
      role: m.role,
      season: row.season,
    };
  });
}

/**
 * Leagues the user belongs to (**ADMIN** or **MEMBER**), with the current NFL season row when
 * present (Story 2.5). Sorted by league name ascending. Both roles are participant roles for
 * authorization (`isLeagueParticipantRole` in Story 2.6); do not filter to **MEMBER** only here.
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
    orderBy: { league: { name: "asc" } },
  });

  return mapMembershipsToJoinedRows(memberships);
}

/** Participant-facing one-line season summary (Story 2.5 AC1, AC8). */
export function describeSeasonForParticipant(args: {
  nflSeasonYear: number;
  season: JoinedLeagueWithCurrentSeasonRow["season"];
}): string {
  const { nflSeasonYear, season } = args;
  if (!season) {
    return `This league does not have season details for NFL ${nflSeasonYear} yet. If that continues, ask a league admin.`;
  }
  const weekNote =
    season.firstCompetitionWeek > 1
      ? `Competition starts NFL Week ${season.firstCompetitionWeek}. `
      : "";
  const init = season.preSeasonInitializedAt
    ? "Pre-season initialized"
    : "Pre-season not yet initialized";
  return `${weekNote}Current season: ${season.nflSeasonYear} · First competition week ${season.firstCompetitionWeek} · ${init}`;
}
