import type { AdminSubmittedPick } from "@/lib/admin/submitted-pick";
import { isLeagueWeekPickWindowClosed } from "@/lib/domain/pick-deadline";
import { prisma as prismaSingleton } from "@/lib/db";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { resolveGamesForLeague } from "@/lib/nfl/resolve-games-for-league";
import {
  resolveActiveWeekNumber,
  type MinimalNflGameForPicksWeek,
  type MinimalSeasonForPicksWeek,
} from "@/lib/nfl/resolve-picks-week";
import { userDisplayName } from "@/lib/user-display-name";

export type {
  AdminSubmittedPick,
  AdminSubmittedPickRedacted,
  AdminSubmittedPickVisible,
} from "@/lib/admin/submitted-pick";
export { isAdminSubmittedPickVisible } from "@/lib/admin/submitted-pick";

export type AdminSubmissionStatusParticipant = {
  membershipId: string;
  displayName: string;
  imageUrl: string | null;
  userId: string;
  submittedPick: AdminSubmittedPick | null;
};

export type AdminSubmissionStatusPayload = {
  weekNumber: number | null;
  participants: AdminSubmissionStatusParticipant[];
};

type MembershipRow = {
  id: string;
  createdAt: Date;
  user: { id: string; name: string | null; email: string; image: string | null };
};

type PickRow = {
  leagueMembershipId: string;
  antiJailedBonus: boolean;
  updatedAt: Date;
  team: { name: string; abbreviation: string };
};

function toSubmittedPick(pick: PickRow, revealTeam: boolean): AdminSubmittedPick {
  if (revealTeam) {
    return {
      teamName: pick.team.name,
      teamAbbreviation: pick.team.abbreviation,
      antiJailedBonus: pick.antiJailedBonus,
      updatedAt: pick.updatedAt.toISOString(),
    };
  }
  return { updatedAt: pick.updatedAt.toISOString() };
}

export function mergeSubmissionStatusParticipants(
  memberships: MembershipRow[],
  picks: PickRow[],
  options: { revealTeamIdentity: boolean; viewerUserId?: string } = {
    revealTeamIdentity: false,
  },
): AdminSubmissionStatusParticipant[] {
  const picksByMembershipId = new Map<string, PickRow>();
  for (const pick of picks) {
    picksByMembershipId.set(pick.leagueMembershipId, pick);
  }

  return memberships.map((membership) => {
    const pick = picksByMembershipId.get(membership.id) ?? null;
    const revealTeam =
      options.revealTeamIdentity || membership.user.id === options.viewerUserId;
    return {
      membershipId: membership.id,
      displayName: userDisplayName(membership.user),
      imageUrl: membership.user.image,
      userId: membership.user.id,
      submittedPick: pick ? toSubmittedPick(pick, revealTeam) : null,
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
  args: { leagueId: string; viewerUserId?: string },
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

  const minimalGames = await resolveGamesForLeague(db, {
    leagueId,
    nflSeasonYear: season.nflSeasonYear,
    isTestLeague,
  });

  const gamesForResolve: MinimalNflGameForPicksWeek[] = minimalGames
    .filter((g): g is typeof g & { kickoffAt: Date } => g.kickoffAt != null)
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
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
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

  const weekGames = minimalGames.filter((g) => g.weekNumber === weekNumber);
  const pickWindowClosed = isLeagueWeekPickWindowClosed({
    at: now,
    weekNumber,
    games: weekGames,
    isTestLeague,
    simulatedCurrentWeek: season.simulatedCurrentWeek,
  });

  return {
    weekNumber,
    participants: mergeSubmissionStatusParticipants(memberships, picks, {
      revealTeamIdentity: pickWindowClosed,
      viewerUserId: args.viewerUserId,
    }),
  };
}
