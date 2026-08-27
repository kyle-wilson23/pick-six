import { LeagueMembershipRole, type PrismaClient } from "@prisma/client";

import { isLeagueWeekPickWindowClosed } from "@/lib/domain/pick-deadline";
import { resolveGamesForLeague } from "@/lib/nfl/resolve-games-for-league";
import { isWeekFullyFinalized } from "@/lib/scoring/finalize-nfl-week";
import type { PickHistoryOutcome } from "@/lib/scoring/get-personal-pick-history";
import { userDisplayName } from "@/lib/user-display-name";

export type PeerPickEntry = {
  membershipId: string;
  displayName: string;
  imageUrl: string | null;
  /** Null when an admin views an open-window week (team identity redacted). */
  teamAbbreviation: string | null;
  /** Null when an admin views an open-window week (team identity redacted). */
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
      select: { id: true, simulatedCurrentWeek: true },
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

  const revealedWeeks = new Set<number>();
  for (const [week, games] of gamesByWeek) {
    if (isWeekFullyFinalized(games)) revealedWeeks.add(week);
  }

  const picks = await prisma.pick.findMany({
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
  });

  const weekMap = new Map<number, PeerPickEntry[]>();
  for (const p of picks) {
    const wk = p.nflWeekNumber;
    const isRevealed = revealedWeeks.has(wk);
    if (!isAdmin && !isRevealed) continue;

    const weekGames = gamesByWeek.get(wk) ?? [];
    const pickWindowClosed = isLeagueWeekPickWindowClosed({
      at: now,
      weekNumber: wk,
      games: weekGames,
      isTestLeague: league?.isTestLeague ?? false,
      simulatedCurrentWeek: season.simulatedCurrentWeek,
    });
    const isOwnPick = p.leagueMembership.id === opts.callerMembershipId;
    const redactTeam = isAdmin && !pickWindowClosed && !isOwnPick;

    const entries = weekMap.get(wk) ?? [];
    entries.push({
      membershipId: p.leagueMembership.id,
      displayName: userDisplayName(p.leagueMembership.user),
      imageUrl: p.leagueMembership.user.image,
      teamAbbreviation: redactTeam ? null : p.team.abbreviation,
      teamName: redactTeam ? null : p.team.name,
      antiJailedBonus: redactTeam ? false : p.antiJailedBonus,
      outcome: redactTeam ? "PENDING" : (p.outcome ?? "PENDING"),
      pointsEarned: redactTeam || p.outcome == null ? null : (p.pointsEarned ?? 0),
    });
    weekMap.set(wk, entries);
  }

  const weeks: WeekPeerPicks[] = [];
  for (const [weekNumber, entries] of weekMap) {
    entries.sort((a, b) => a.displayName.localeCompare(b.displayName, "en"));
    weeks.push({ weekNumber, isRevealed: revealedWeeks.has(weekNumber), entries });
  }
  weeks.sort((a, b) => b.weekNumber - a.weekNumber);

  return { weeks };
}
