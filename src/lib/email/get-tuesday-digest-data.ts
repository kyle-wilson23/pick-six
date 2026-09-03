import { prisma } from "@/lib/db";
import { computePickDeadlineUtc, getFirstKickoffUtc } from "@/lib/domain/pick-deadline";
import { getAppBaseUrl } from "@/lib/email/app-base-url";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { getJailedWithTeamForLeagueWeek } from "@/lib/nfl/league-jailed";
import { resolveGamesForLeague } from "@/lib/nfl/resolve-games-for-league";
import { isAutomatedEmailWeekActive } from "@/lib/email/is-automated-email-week-active";
import {
  resolveActiveWeekNumber,
  type MinimalNflGameForPicksWeek,
  type MinimalSeasonForPicksWeek,
} from "@/lib/nfl/resolve-picks-week";
import { getLeagueStandings, type StandingsEntry } from "@/lib/scoring/get-league-standings";
import { userDisplayName } from "@/lib/user-display-name";

export type TuesdayDigestData = {
  leagueName: string;
  leagueId: string;
  isTestLeague: boolean;
  nflSeasonYear: number;
  weekNumber: number;
  /** True when competition has not started (picks preview). Cron skips; admin may still send. */
  isPreviewWeek: boolean;
  /** FR26 lock instant for `weekNumber`, or `null` when that week has no schedule data. */
  pickDeadlineUtc: Date | null;
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

  const minimalGames = await resolveGamesForLeague(prisma, {
    leagueId,
    nflSeasonYear: season.nflSeasonYear,
    isTestLeague: league.isTestLeague,
  });

  const gamesForResolve: MinimalNflGameForPicksWeek[] = minimalGames
    .filter((g): g is typeof g & { kickoffAt: Date } => g.kickoffAt != null)
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

  const isPreviewWeek = !isAutomatedEmailWeekActive({
    isTestLeague: league.isTestLeague,
    season: {
      preSeasonInitializedAt: season.preSeasonInitializedAt,
      firstCompetitionWeek: season.firstCompetitionWeek,
    },
    resolvedWeekNumber: weekNumber,
    allSeasonGames: gamesForResolve,
    now,
  });

  const firstKickoff = getFirstKickoffUtc(
    gamesForResolve.filter((g) => g.weekNumber === weekNumber),
  );
  const pickDeadlineUtc = firstKickoff == null ? null : computePickDeadlineUtc(firstKickoff);

  const [standings, jailedRow, memberships] = await Promise.all([
    getLeagueStandings(prisma, { leagueId, nflSeasonYear: season.nflSeasonYear }),
    getJailedWithTeamForLeagueWeek(prisma, {
      leagueId,
      nflSeasonYear: season.nflSeasonYear,
      weekNumber,
      isTestLeague: league.isTestLeague,
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
    isPreviewWeek,
    pickDeadlineUtc,
    standings,
    jailedTeamName: jailedRow?.jailedTeam.name ?? null,
    jailedTeamAbbreviation: jailedRow?.jailedTeam.abbreviation ?? null,
    picksUrl,
    members: memberships.map((m) => ({
      membershipId: m.id,
      email: m.user.email,
      displayName: userDisplayName(m.user),
    })),
  };
}
