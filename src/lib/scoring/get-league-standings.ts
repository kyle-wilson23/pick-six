import type { PrismaClient } from "@prisma/client";

import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";
import { resolveGamesForLeague } from "@/lib/nfl/resolve-games-for-league";
import { userDisplayName } from "@/lib/user-display-name";

import { countMissedWeeks, finalizedCompetitionWeekNumbers } from "./record-tally";

export type StandingsEntry = {
  membershipId: string;
  displayName: string;
  imageUrl: string | null;
  totalPoints: number;
  wins: number;
  losses: number;
  ties: number;
  /** Finalized competition weeks with no Pick row. Display-only; not a valid loss. */
  missedWeeks: number;
  rank: number;
};

export async function getLeagueStandings(
  prisma: PrismaClient,
  opts: { leagueId: string; nflSeasonYear: number },
): Promise<StandingsEntry[]> {
  const [season, league] = await Promise.all([
    prisma.season.findFirst({
      where: { leagueId: opts.leagueId, nflSeasonYear: opts.nflSeasonYear },
      select: { id: true, firstCompetitionWeek: true },
    }),
    prisma.league.findUnique({
      where: { id: opts.leagueId },
      select: { isTestLeague: true },
    }),
  ]);

  const [games, memberships] = await Promise.all([
    season && league
      ? resolveGamesForLeague(prisma, {
          leagueId: opts.leagueId,
          nflSeasonYear: opts.nflSeasonYear,
          isTestLeague: league.isTestLeague,
        })
      : Promise.resolve([]),
    prisma.leagueMembership.findMany({
      where: leaguePlayerMembershipWhere(opts.leagueId),
      include: {
        user: { select: { name: true, email: true, image: true } },
        picks: season
          ? {
              where: { seasonId: season.id },
              select: {
                nflWeekNumber: true,
                outcome: true,
                pointsEarned: true,
                scoredAt: true,
              },
            }
          : false,
      },
    }),
  ]);

  const finalizedWeeks =
    season && league
      ? finalizedCompetitionWeekNumbers(games, season.firstCompetitionWeek)
      : [];

  const unsorted: Omit<StandingsEntry, "rank">[] = memberships.map((m) => {
    const picks = season ? (m.picks ?? []) : [];
    const scoredPicks = picks.filter((pick) => pick.scoredAt != null);
    const totalPoints = scoredPicks.reduce((sum, pick) => sum + (pick.pointsEarned ?? 0), 0);
    const wins = scoredPicks.filter((pick) => pick.outcome === "WIN").length;
    const losses = scoredPicks.filter((pick) => pick.outcome === "LOSS").length;
    const ties = scoredPicks.filter((pick) => pick.outcome === "TIE").length;
    const missedWeeks = countMissedWeeks(
      finalizedWeeks,
      picks.map((pick) => pick.nflWeekNumber),
    );
    return {
      membershipId: m.id,
      displayName: userDisplayName(m.user),
      imageUrl: m.user.image,
      totalPoints,
      wins,
      losses,
      ties,
      missedWeeks,
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
