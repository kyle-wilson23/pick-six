import { prisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/email/app-base-url";
import {
  LeagueNotFoundError,
  NoActiveWeekError,
} from "@/lib/email/get-tuesday-digest-data";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import {
  resolvePicksWeekNumber,
  type MinimalNflGameForPicksWeek,
  type MinimalSeasonForPicksWeek,
} from "@/lib/nfl/resolve-picks-week";

export type ReminderData = {
  leagueName: string;
  leagueId: string;
  nflSeasonYear: number;
  weekNumber: number;
  jailedTeamName: string | null;
  jailedTeamAbbreviation: string | null;
  picksUrl: string;
  outstandingMembers: Array<{
    membershipId: string;
    email: string;
    displayName: string;
  }>;
  submittedCount: number;
};

export { LeagueNotFoundError, NoActiveWeekError };

function canResolveActiveWeek(
  season: { preSeasonInitializedAt: Date | null } | null,
  gamesWithKickoff: MinimalNflGameForPicksWeek[],
): boolean {
  if (!season || season.preSeasonInitializedAt == null) {
    return false;
  }
  return gamesWithKickoff.length > 0;
}

export async function getReminderData({
  leagueId,
}: {
  leagueId: string;
}): Promise<ReminderData> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true },
  });

  if (!league) {
    throw new LeagueNotFoundError(leagueId);
  }

  const season = await resolveCurrentSeasonForLeague(prisma.season, leagueId);

  if (!season || season.preSeasonInitializedAt == null) {
    throw new NoActiveWeekError();
  }

  const minimalGames = await prisma.nflGame.findMany({
    where: { nflSeasonYear: season.nflSeasonYear },
    select: {
      weekNumber: true,
      kickoffAt: true,
    },
  });

  const gamesForResolve: MinimalNflGameForPicksWeek[] = minimalGames
    .filter((g): g is { weekNumber: number; kickoffAt: Date } => g.kickoffAt != null)
    .map((g) => ({ weekNumber: g.weekNumber, kickoffAt: g.kickoffAt }));

  if (!canResolveActiveWeek(season, gamesForResolve)) {
    throw new NoActiveWeekError();
  }

  const seasonForResolve: MinimalSeasonForPicksWeek = {
    preSeasonInitializedAt: season.preSeasonInitializedAt,
    firstCompetitionWeek: season.firstCompetitionWeek,
  };

  const weekNumber = resolvePicksWeekNumber(seasonForResolve, gamesForResolve);

  const [jailedRow, memberships, picks] = await Promise.all([
    prisma.nflWeekJailedTeam.findUnique({
      where: {
        nflSeasonYear_weekNumber: {
          nflSeasonYear: season.nflSeasonYear,
          weekNumber,
        },
      },
      include: {
        jailedTeam: { select: { name: true, abbreviation: true } },
      },
    }),
    prisma.leagueMembership.findMany({
      where: { leagueId },
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pick.findMany({
      where: {
        seasonId: season.id,
        nflWeekNumber: weekNumber,
        leagueMembership: { leagueId },
      },
      select: { leagueMembershipId: true },
    }),
  ]);

  const pickedMembershipIds = new Set(picks.map((p) => p.leagueMembershipId));

  const outstandingMembers = memberships
    .filter((m) => !pickedMembershipIds.has(m.id))
    .map((m) => ({
      membershipId: m.id,
      email: m.user.email,
      displayName: m.user.name ?? m.user.email,
    }));

  const picksUrl = `${getAppBaseUrl()}/leagues/${leagueId}/picks`;

  return {
    leagueName: league.name,
    leagueId: league.id,
    nflSeasonYear: season.nflSeasonYear,
    weekNumber,
    jailedTeamName: jailedRow?.jailedTeam.name ?? null,
    jailedTeamAbbreviation: jailedRow?.jailedTeam.abbreviation ?? null,
    picksUrl,
    outstandingMembers,
    submittedCount: picks.length,
  };
}
