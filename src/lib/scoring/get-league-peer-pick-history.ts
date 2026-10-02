import { LeagueMembershipRole, type PrismaClient } from "@prisma/client";

import { isSuperuserEmail } from "@/lib/auth/is-superuser";
import { isLeagueWeekPickWindowClosed } from "@/lib/domain/pick-deadline";
import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";
import { isWeekInLeagueCompetition } from "@/lib/nfl/nfl-regular-season";
import { resolveGamesForLeague } from "@/lib/nfl/resolve-games-for-league";
import { isWeekFullyFinalized } from "@/lib/scoring/finalize-nfl-week";
import type { PickHistoryOutcome } from "@/lib/scoring/get-personal-pick-history";
import { userDisplayName } from "@/lib/user-display-name";

export type PeerPickEntry = {
  membershipId: string;
  displayName: string;
  imageUrl: string | null;
  /**
   * False when this player has no saved pick for the week.
   * True when a saved pick exists (team may still be redacted).
   */
  hasPick: boolean;
  /** Null when the team is hidden (admin, open window) or the player did not pick. */
  teamAbbreviation: string | null;
  /** Null when the team is hidden (admin, open window) or the player did not pick. */
  teamName: string | null;
  antiJailedBonus: boolean;
  outcome: PickHistoryOutcome;
  pointsEarned: number | null;
};

export type WeekPeerPicks = {
  weekNumber: number;
  isRevealed: boolean;
  entries: PeerPickEntry[];
};

export type LeaguePeerPickHistory = {
  weeks: WeekPeerPicks[];
};

const EMPTY: LeaguePeerPickHistory = { weeks: [] };

type RosterMember = {
  id: string;
  user: { name: string | null; email: string; image: string | null };
};

type SavedPick = {
  nflWeekNumber: number;
  antiJailedBonus: boolean;
  outcome: "WIN" | "LOSS" | "TIE" | null;
  pointsEarned: number | null;
  team: { abbreviation: string; name: string };
  leagueMembership: RosterMember;
};

export async function getLeaguePeerPickHistory(
  prisma: PrismaClient,
  opts: {
    leagueId: string;
    nflSeasonYear: number;
    callerRole: LeagueMembershipRole;
    callerMembershipId?: string;
    now?: Date;
  },
): Promise<LeaguePeerPickHistory> {
  const now = opts.now ?? new Date();
  const [season, league] = await Promise.all([
    prisma.season.findUnique({
      where: {
        leagueId_nflSeasonYear: {
          leagueId: opts.leagueId,
          nflSeasonYear: opts.nflSeasonYear,
        },
      },
      select: { id: true, simulatedCurrentWeek: true, firstCompetitionWeek: true },
    }),
    prisma.league.findUnique({
      where: { id: opts.leagueId },
      select: { isTestLeague: true },
    }),
  ]);
  if (!season) return { ...EMPTY };

  const allGames = await resolveGamesForLeague(prisma, {
    leagueId: opts.leagueId,
    nflSeasonYear: opts.nflSeasonYear,
    isTestLeague: league?.isTestLeague ?? false,
  });

  const isAdmin = opts.callerRole === LeagueMembershipRole.ADMIN;

  const gamesByWeek = new Map<number, typeof allGames>();
  for (const g of allGames) {
    const list = gamesByWeek.get(g.weekNumber) ?? [];
    list.push(g);
    gamesByWeek.set(g.weekNumber, list);
  }

  const [picks, memberships] = await Promise.all([
    prisma.pick.findMany({
      where: { seasonId: season.id },
      select: {
        nflWeekNumber: true,
        antiJailedBonus: true,
        outcome: true,
        pointsEarned: true,
        team: { select: { abbreviation: true, name: true } },
        leagueMembership: {
          select: {
            id: true,
            user: { select: { name: true, email: true, image: true } },
          },
        },
      },
    }),
    prisma.leagueMembership.findMany({
      where: leaguePlayerMembershipWhere(opts.leagueId),
      select: {
        id: true,
        user: { select: { name: true, email: true, image: true } },
      },
    }),
  ]);

  const players = memberships.filter((m) => !isSuperuserEmail(m.user.email));
  const picksByWeekAndMember = indexRosterPicks(picks);

  const candidateWeeks = new Set<number>([
    ...gamesByWeek.keys(),
    ...picksByWeekAndMember.keys(),
  ]);

  const weeks: WeekPeerPicks[] = [];
  for (const weekNumber of candidateWeeks) {
    if (!isWeekInLeagueCompetition(season, weekNumber)) continue;

    const weekGames = gamesByWeek.get(weekNumber) ?? [];
    const isRevealed = weekGames.length > 0 && isWeekFullyFinalized(weekGames);
    const weekPicks = picksByWeekAndMember.get(weekNumber);
    const hasNonSuperuserPick = (weekPicks?.size ?? 0) > 0;
    if (!isRevealed && !(isAdmin && hasNonSuperuserPick)) continue;

    const pickWindowClosed = isLeagueWeekPickWindowClosed({
      at: now,
      weekNumber,
      games: weekGames,
      isTestLeague: league?.isTestLeague ?? false,
      simulatedCurrentWeek: season.simulatedCurrentWeek,
    });

    const entries = players.map((member) => {
      const pick = weekPicks?.get(member.id);
      if (!pick) {
        return noPickEntry(member, isRevealed);
      }
      return pickEntry(pick, member, {
        redactTeam: isAdmin && !pickWindowClosed && member.id !== opts.callerMembershipId,
      });
    });
    entries.sort((a, b) => a.displayName.localeCompare(b.displayName, "en"));
    weeks.push({ weekNumber, isRevealed, entries });
  }
  weeks.sort((a, b) => b.weekNumber - a.weekNumber);

  return { weeks };
}

function indexRosterPicks(picks: SavedPick[]): Map<number, Map<string, SavedPick>> {
  const picksByWeekAndMember = new Map<number, Map<string, SavedPick>>();
  for (const pick of picks) {
    if (isSuperuserEmail(pick.leagueMembership.user.email)) continue;
    const byMember = picksByWeekAndMember.get(pick.nflWeekNumber) ?? new Map<string, SavedPick>();
    if (!byMember.has(pick.leagueMembership.id)) {
      byMember.set(pick.leagueMembership.id, pick);
    }
    picksByWeekAndMember.set(pick.nflWeekNumber, byMember);
  }
  return picksByWeekAndMember;
}

function noPickEntry(member: RosterMember, isRevealed: boolean): PeerPickEntry {
  return {
    membershipId: member.id,
    displayName: userDisplayName(member.user),
    imageUrl: member.user.image,
    hasPick: false,
    teamAbbreviation: null,
    teamName: null,
    antiJailedBonus: false,
    outcome: "PENDING",
    pointsEarned: isRevealed ? 0 : null,
  };
}

function pickEntry(
  pick: SavedPick,
  member: RosterMember,
  opts: { redactTeam: boolean },
): PeerPickEntry {
  const { redactTeam } = opts;
  return {
    membershipId: member.id,
    displayName: userDisplayName(member.user),
    imageUrl: member.user.image,
    hasPick: true,
    teamAbbreviation: redactTeam ? null : pick.team.abbreviation,
    teamName: redactTeam ? null : pick.team.name,
    antiJailedBonus: redactTeam ? false : pick.antiJailedBonus,
    outcome: redactTeam ? "PENDING" : (pick.outcome ?? "PENDING"),
    pointsEarned: redactTeam || pick.outcome == null ? null : (pick.pointsEarned ?? 0),
  };
}
