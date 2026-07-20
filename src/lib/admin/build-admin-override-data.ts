import { prisma as prismaSingleton } from "@/lib/db";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
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

  const minimalGames = await db.nflGame.findMany({
    where: { nflSeasonYear: season.nflSeasonYear },
    select: {
      weekNumber: true,
      kickoffAt: true,
    },
  });

  const gamesForResolve: MinimalNflGameForPicksWeek[] = minimalGames
    .filter((g): g is { weekNumber: number; kickoffAt: Date } => g.kickoffAt != null)
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

  const jailed = await db.nflWeekJailedTeam.findUnique({
    where: {
      nflSeasonYear_weekNumber: {
        nflSeasonYear: season.nflSeasonYear,
        weekNumber,
      },
    },
    select: { jailedTeamId: true },
  });
  if (!jailed) {
    return null;
  }

  const weekGames = await db.nflGame.findMany({
    where: { nflSeasonYear: season.nflSeasonYear, weekNumber },
    include: {
      homeTeam: { select: { id: true, name: true, abbreviation: true } },
      awayTeam: { select: { id: true, name: true, abbreviation: true } },
    },
    orderBy: { kickoffAt: "asc" },
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

  return {
    weekNumber,
    jailedTeamId: jailed.jailedTeamId,
    games: weekGames.map((g) => ({
      homeTeamId: g.homeTeam.id,
      homeTeamName: g.homeTeam.name,
      homeTeamAbbreviation: g.homeTeam.abbreviation,
      awayTeamId: g.awayTeam.id,
      awayTeamName: g.awayTeam.name,
      awayTeamAbbreviation: g.awayTeam.abbreviation,
    })),
    allSeasonPicks: allSeasonPicks.map((p) => ({
      membershipId: p.leagueMembershipId,
      nflWeekNumber: p.nflWeekNumber,
      teamId: p.teamId,
    })),
  };
}
