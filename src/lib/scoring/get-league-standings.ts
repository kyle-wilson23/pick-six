import type { PrismaClient } from "@prisma/client";

export type StandingsEntry = {
  membershipId: string;
  displayName: string;
  totalPoints: number;
  wins: number;
  losses: number;
  ties: number;
  rank: number;
};

export async function getLeagueStandings(
  prisma: PrismaClient,
  opts: { leagueId: string; nflSeasonYear: number },
): Promise<StandingsEntry[]> {
  const season = await prisma.season.findFirst({
    where: { leagueId: opts.leagueId, nflSeasonYear: opts.nflSeasonYear },
    select: { id: true },
  });

  const memberships = await prisma.leagueMembership.findMany({
    where: { leagueId: opts.leagueId },
    include: {
      user: { select: { name: true, email: true } },
      picks: season
        ? {
            where: { seasonId: season.id, scoredAt: { not: null } },
            select: { outcome: true, pointsEarned: true },
          }
        : false,
    },
  });

  const unsorted: Omit<StandingsEntry, "rank">[] = memberships.map((m) => {
    const picks = season ? (m.picks ?? []) : [];
    const totalPoints = picks.reduce((s, p) => s + (p.pointsEarned ?? 0), 0);
    const wins = picks.filter((p) => p.outcome === "WIN").length;
    const losses = picks.filter((p) => p.outcome === "LOSS").length;
    const ties = picks.filter((p) => p.outcome === "TIE").length;
    return {
      membershipId: m.id,
      displayName: m.user.name ?? m.user.email,
      totalPoints,
      wins,
      losses,
      ties,
    };
  });

  unsorted.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.displayName.localeCompare(b.displayName);
  });

  const result: StandingsEntry[] = [];
  for (let i = 0; i < unsorted.length; i++) {
    const rank =
      i > 0 && unsorted[i].totalPoints === unsorted[i - 1].totalPoints
        ? result[i - 1].rank
        : i + 1;
    result.push({ ...unsorted[i], rank });
  }
  return result;
}
