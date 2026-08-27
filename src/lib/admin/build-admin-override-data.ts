import { isLeagueWeekPickWindowClosed } from "@/lib/domain/pick-deadline";
import { prisma as prismaSingleton } from "@/lib/db";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { getJailedTeamIdForLeagueWeek } from "@/lib/nfl/league-jailed";
import {
  resolveGamesForLeague,
  resolveGamesForLeagueWithTeams,
} from "@/lib/nfl/resolve-games-for-league";
import {
  resolveActiveWeekNumber,
  type MinimalNflGameForPicksWeek,
  type MinimalSeasonForPicksWeek,
} from "@/lib/nfl/resolve-picks-week";

export type GameTeamPair = {
  homeTeamId: string;
  homeTeamName: string;
  homeTeamAbbreviation: string;
  awayTeamId: string;
  awayTeamName: string;
  awayTeamAbbreviation: string;
};

export type ParticipantSeasonPick = {
  membershipId: string;
  nflWeekNumber: number;
  teamId: string;
};

export type AdminOverrideData = {
  weekNumber: number;
  jailedTeamId: string;
  games: GameTeamPair[];
  allSeasonPicks: ParticipantSeasonPick[];
  /** False when the active week's window is still open or the deadline is indeterminate. */
  pickWindowClosed: boolean;
};

function canResolveActiveWeek(args: {
  season: { preSeasonInitializedAt: Date | null; simulatedCurrentWeek?: number | null } | null;
  gamesWithKickoff: MinimalNflGameForPicksWeek[];
  isTestLeague: boolean;
}): boolean {
  const { season, gamesWithKickoff, isTestLeague } = args;
  if (!season || season.preSeasonInitializedAt == null) {
    return false;
  }
  // Test leagues use the simulation clock even when no NflGame rows exist yet (Story 8.2 / 8.3).
  if (isTestLeague && season.simulatedCurrentWeek != null) {
    return true;
  }
  return gamesWithKickoff.length > 0;
}

export async function buildAdminOverrideData(
  args: { leagueId: string },
  now: Date = new Date(),
): Promise<AdminOverrideData | null> {
  const { leagueId } = args;
  const db = prismaSingleton;

  const [season, leagueRow] = await Promise.all([
    resolveCurrentSeasonForLeague(db.season, leagueId),
    db.league.findUnique({
      where: { id: leagueId },
      select: { isTestLeague: true },
    }),
  ]);
  if (!season || season.preSeasonInitializedAt == null) {
    return null;
  }

  const isTestLeague = leagueRow?.isTestLeague ?? false;

  const minimalGames = await resolveGamesForLeague(db, {
    leagueId,
    nflSeasonYear: season.nflSeasonYear,
    isTestLeague,
  });

  const gamesForResolve: MinimalNflGameForPicksWeek[] = minimalGames
    .filter((g): g is typeof g & { kickoffAt: Date } => g.kickoffAt != null)
    .map((g) => ({ weekNumber: g.weekNumber, kickoffAt: g.kickoffAt }));

  if (!canResolveActiveWeek({ season, gamesWithKickoff: gamesForResolve, isTestLeague })) {
    return null;
  }

  const seasonForResolve: MinimalSeasonForPicksWeek = {
    preSeasonInitializedAt: season.preSeasonInitializedAt,
    firstCompetitionWeek: season.firstCompetitionWeek,
    simulatedCurrentWeek: season.simulatedCurrentWeek,
  };

  const weekNumber = resolveActiveWeekNumber({
    isTestLeague,
    season: seasonForResolve,
    gamesForYear: gamesForResolve,
    now,
  });

  const jailedTeamId = await getJailedTeamIdForLeagueWeek(db, {
    leagueId,
    nflSeasonYear: season.nflSeasonYear,
    weekNumber,
    isTestLeague,
  });
  if (!jailedTeamId) {
    return null;
  }

  const weekGames = await resolveGamesForLeagueWithTeams(db, {
    leagueId,
    nflSeasonYear: season.nflSeasonYear,
    weekNumber,
    isTestLeague,
  });
  if (weekGames.length === 0) {
    return null;
  }

  const allSeasonPicks = await db.pick.findMany({
    where: { seasonId: season.id },
    select: {
      leagueMembershipId: true,
      nflWeekNumber: true,
      teamId: true,
    },
  });

  const pickWindowClosedByWeek = new Map<number, boolean>();
  function isWeekPickWindowClosed(nflWeekNumber: number): boolean {
    const cached = pickWindowClosedByWeek.get(nflWeekNumber);
    if (cached !== undefined) return cached;
    const closed = isLeagueWeekPickWindowClosed({
      at: now,
      weekNumber: nflWeekNumber,
      games: minimalGames.filter((g) => g.weekNumber === nflWeekNumber),
      isTestLeague,
      simulatedCurrentWeek: season.simulatedCurrentWeek,
    });
    pickWindowClosedByWeek.set(nflWeekNumber, closed);
    return closed;
  }

  return {
    weekNumber,
    jailedTeamId,
    games: weekGames.map((g) => ({
      homeTeamId: g.homeTeam.id,
      homeTeamName: g.homeTeam.name,
      homeTeamAbbreviation: g.homeTeam.abbreviation,
      awayTeamId: g.awayTeam.id,
      awayTeamName: g.awayTeam.name,
      awayTeamAbbreviation: g.awayTeam.abbreviation,
    })),
    allSeasonPicks: allSeasonPicks
      .filter((p) => isWeekPickWindowClosed(p.nflWeekNumber))
      .map((p) => ({
        membershipId: p.leagueMembershipId,
        nflWeekNumber: p.nflWeekNumber,
        teamId: p.teamId,
      })),
    pickWindowClosed: isWeekPickWindowClosed(weekNumber),
  };
}
