import { prisma as prismaSingleton } from "@/lib/db";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import {
  resolvePicksWeekNumber,
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

function canResolveActiveWeek(
  season: { preSeasonInitializedAt: Date | null } | null,
  gamesWithKickoff: MinimalNflGameForPicksWeek[],
): boolean {
  if (!season || season.preSeasonInitializedAt == null) {
    return false;
  }
  return gamesWithKickoff.length > 0;
}

export async function buildSubmissionStatus(
  args: { leagueId: string },
  now: Date = new Date(),
): Promise<AdminSubmissionStatusPayload> {
  const { leagueId } = args;
  const db = prismaSingleton;

  const season = await resolveCurrentSeasonForLeague(db.season, leagueId);

  if (!season) {
    return { weekNumber: null, participants: [] };
  }

  if (season.preSeasonInitializedAt == null) {
    return { weekNumber: null, participants: [] };
  }

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

  if (!canResolveActiveWeek(season, gamesForResolve)) {
    return { weekNumber: null, participants: [] };
  }

  const seasonForResolve: MinimalSeasonForPicksWeek = {
    preSeasonInitializedAt: season.preSeasonInitializedAt,
    firstCompetitionWeek: season.firstCompetitionWeek,
  };

  const weekNumber = resolvePicksWeekNumber(seasonForResolve, gamesForResolve, now);

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
