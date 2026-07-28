import { prisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/email/app-base-url";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import {
  resolveActiveWeekNumber,
  type MinimalNflGameForPicksWeek,
  type MinimalSeasonForPicksWeek,
} from "@/lib/nfl/resolve-picks-week";
import { getLeagueStandings, type StandingsEntry } from "@/lib/scoring/get-league-standings";

export type TuesdayDigestData = {
  leagueName: string;
  leagueId: string;
  isTestLeague: boolean;
  nflSeasonYear: number;
  weekNumber: number;
  standings: StandingsEntry[];
  jailedTeamName: string | null;
  jailedTeamAbbreviation: string | null;
  picksUrl: string;
  members: Array<{
    membershipId: string;
    email: string;
    displayName: string;
  }>;
};

export class NoActiveWeekError extends Error {
  constructor() {
    super("No active week for Tuesday digest");
    this.name = "NoActiveWeekError";
  }
}

export class LeagueNotFoundError extends Error {
  constructor(leagueId: string) {
    super(`League not found: ${leagueId}`);
    this.name = "LeagueNotFoundError";
  }
}

function canResolveActiveWeek(args: {
  season: { preSeasonInitializedAt: Date | null; simulatedCurrentWeek?: number | null } | null;
  gamesWithKickoff: MinimalNflGameForPicksWeek[];
  isTestLeague: boolean;
}): boolean {
  const { season, gamesWithKickoff, isTestLeague } = args;
  if (!season || season.preSeasonInitializedAt == null) {
    return false;
  }
  if (isTestLeague && season.simulatedCurrentWeek != null) {
    return true;
  }
  return gamesWithKickoff.length > 0;
}

export async function getTuesdayDigestData(
  { leagueId }: { leagueId: string },
  now: Date = new Date(),
): Promise<TuesdayDigestData> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, isTestLeague: true },
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

  if (
    !canResolveActiveWeek({
      season,
      gamesWithKickoff: gamesForResolve,
      isTestLeague: league.isTestLeague,
    })
  ) {
    throw new NoActiveWeekError();
  }

  const seasonForResolve: MinimalSeasonForPicksWeek = {
    preSeasonInitializedAt: season.preSeasonInitializedAt,
    firstCompetitionWeek: season.firstCompetitionWeek,
    simulatedCurrentWeek: season.simulatedCurrentWeek,
  };

  const weekNumber = resolveActiveWeekNumber({
    isTestLeague: league.isTestLeague,
    season: seasonForResolve,
    gamesForYear: gamesForResolve,
    now,
  });

  const [standings, jailedRow, memberships] = await Promise.all([
    getLeagueStandings(prisma, { leagueId, nflSeasonYear: season.nflSeasonYear }),
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
  ]);

  const picksUrl = `${getAppBaseUrl()}/leagues/${leagueId}/picks`;

  return {
    leagueName: league.name,
    leagueId: league.id,
    isTestLeague: league.isTestLeague,
    nflSeasonYear: season.nflSeasonYear,
    weekNumber,
    standings,
    jailedTeamName: jailedRow?.jailedTeam.name ?? null,
    jailedTeamAbbreviation: jailedRow?.jailedTeam.abbreviation ?? null,
    picksUrl,
    members: memberships.map((m) => ({
      membershipId: m.id,
      email: m.user.email,
      displayName: m.user.name ?? m.user.email,
    })),
  };
}
