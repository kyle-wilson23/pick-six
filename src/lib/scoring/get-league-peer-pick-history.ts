import { LeagueMembershipRole, type PrismaClient } from "@prisma/client";

import { isWeekFullyFinalized } from "@/lib/scoring/finalize-nfl-week";
import type { PickHistoryOutcome } from "@/lib/scoring/get-personal-pick-history";

export type PeerPickEntry = {
  membershipId: string;
  displayName: string;
  teamAbbreviation: string;
  teamName: string;
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
  },
): Promise<LeaguePeerPickHistory> {
  const [season, allGames] = await Promise.all([
    prisma.season.findUnique({
      where: {
        leagueId_nflSeasonYear: {
          leagueId: opts.leagueId,
          nflSeasonYear: opts.nflSeasonYear,
        },
      },
      select: { id: true },
    }),
    prisma.nflGame.findMany({
      where: { nflSeasonYear: opts.nflSeasonYear },
      select: { weekNumber: true, status: true },
    }),
  ]);
  if (!season) return { ...EMPTY };

  const isAdmin = opts.callerRole === LeagueMembershipRole.ADMIN;

  const gamesByWeek = new Map<number, Array<{ status: (typeof allGames)[number]["status"] }>>();
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
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  const weekMap = new Map<number, PeerPickEntry[]>();
  for (const p of picks) {
    const wk = p.nflWeekNumber;
    const isRevealed = revealedWeeks.has(wk);
    if (!isAdmin && !isRevealed) continue;

    const entries = weekMap.get(wk) ?? [];
    entries.push({
      membershipId: p.leagueMembership.id,
      displayName: p.leagueMembership.user.name ?? p.leagueMembership.user.email,
      teamAbbreviation: p.team.abbreviation,
      teamName: p.team.name,
      antiJailedBonus: p.antiJailedBonus,
      outcome: p.outcome ?? "PENDING",
      pointsEarned: p.outcome == null ? null : (p.pointsEarned ?? 0),
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
