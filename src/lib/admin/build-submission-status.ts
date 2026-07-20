import { prisma as prismaSingleton } from "@/lib/db";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import {
  resolveActiveWeekNumber,
  type MinimalNflGameForPicksWeek,
  type MinimalSeasonForPicksWeek,
} from "@/lib/nfl/resolve-picks-week";

export type AdminSubmissionStatusParticipant = {
  membershipId: string;
  displayName: string;
  userId: string;
  submittedPick: {
    teamName: string;
    teamAbbreviation: string;
    antiJailedBonus: boolean;
    updatedAt: string;
  } | null;
};

export type AdminSubmissionStatusPayload = {
  weekNumber: number | null;
  participants: AdminSubmissionStatusParticipant[];
};

type MembershipRow = {
  id: string;
  createdAt: Date;
  user: { id: string; name: string | null; email: string };
};

type PickRow = {
  leagueMembershipId: string;
  antiJailedBonus: boolean;
  updatedAt: Date;
  team: { name: string; abbreviation: string };
};

export function mergeSubmissionStatusParticipants(
  memberships: MembershipRow[],
  picks: PickRow[],
): AdminSubmissionStatusParticipant[] {
  const picksByMembershipId = new Map<string, PickRow>();
  for (const pick of picks) {
    picksByMembershipId.set(pick.leagueMembershipId, pick);
  }

  return memberships.map((membership) => {
    const pick = picksByMembershipId.get(membership.id) ?? null;
    return {
      membershipId: membership.id,
      displayName: membership.user.name ?? membership.user.email,
      userId: membership.user.id,
      submittedPick: pick
        ? {
            teamName: pick.team.name,
            teamAbbreviation: pick.team.abbreviation,
            antiJailedBonus: pick.antiJailedBonus,
            updatedAt: pick.updatedAt.toISOString(),
          }
        : null,
    };
  });
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
  // Test leagues use the simulation clock even when no NflGame rows exist yet (Story 8.2 / 8.3).
  if (isTestLeague && season.simulatedCurrentWeek != null) {
    return true;
  }
  return gamesWithKickoff.length > 0;
}

export async function buildSubmissionStatus(
  args: { leagueId: string },
  now: Date = new Date(),
): Promise<AdminSubmissionStatusPayload> {
  const { leagueId } = args;
  const db = prismaSingleton;

  const [season, leagueRow] = await Promise.all([
    resolveCurrentSeasonForLeague(db.season, leagueId),
    db.league.findUnique({
      where: { id: leagueId },
      select: { isTestLeague: true },
    }),
  ]);

  if (!season) {
    return { weekNumber: null, participants: [] };
  }

  if (season.preSeasonInitializedAt == null) {
    return { weekNumber: null, participants: [] };
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
    return { weekNumber: null, participants: [] };
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

  const [memberships, picks] = await Promise.all([
    db.leagueMembership.findMany({
      where: { leagueId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.pick.findMany({
      where: {
        seasonId: season.id,
        nflWeekNumber: weekNumber,
        leagueMembership: { leagueId },
      },
      select: {
        leagueMembershipId: true,
        antiJailedBonus: true,
        updatedAt: true,
        team: { select: { name: true, abbreviation: true } },
      },
    }),
  ]);

  return {
    weekNumber,
    participants: mergeSubmissionStatusParticipants(memberships, picks),
  };
}
