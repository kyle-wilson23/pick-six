import { PickOutcome, type PrismaClient } from "@prisma/client";

export type PickHistoryOutcome = "WIN" | "LOSS" | "TIE" | "PENDING";

export type PickHistoryEntry = {
  nflWeekNumber: number;
  teamAbbreviation: string;
  teamName: string;
  antiJailedBonus: boolean;
  outcome: PickHistoryOutcome;
  pointsEarned: number | null;
};

export type PersonalPickHistory = {
  entries: PickHistoryEntry[];
  totalPoints: number;
  wins: number;
  losses: number;
  ties: number;
};

const EMPTY: PersonalPickHistory = {
  entries: [],
  totalPoints: 0,
  wins: 0,
  losses: 0,
  ties: 0,
};

export async function getPersonalPickHistory(
  prisma: PrismaClient,
  opts: { leagueId: string; nflSeasonYear: number; membershipId: string },
): Promise<PersonalPickHistory> {
  const season = await prisma.season.findFirst({
    where: { leagueId: opts.leagueId, nflSeasonYear: opts.nflSeasonYear },
    select: { id: true },
  });
  if (!season) return { ...EMPTY };

  const picks = await prisma.pick.findMany({
    where: { leagueMembershipId: opts.membershipId, seasonId: season.id },
    select: {
      nflWeekNumber: true,
      antiJailedBonus: true,
      outcome: true,
      pointsEarned: true,
      team: { select: { abbreviation: true, name: true } },
    },
    orderBy: { nflWeekNumber: "asc" },
  });

  const entries: PickHistoryEntry[] = picks.map((p) => ({
    nflWeekNumber: p.nflWeekNumber,
    teamAbbreviation: p.team.abbreviation,
    teamName: p.team.name,
    antiJailedBonus: p.antiJailedBonus,
    outcome: p.outcome ?? "PENDING",
    pointsEarned: p.outcome == null ? null : (p.pointsEarned ?? 0),
  }));

  let totalPoints = 0;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const p of picks) {
    if (p.outcome == null) continue;
    totalPoints += p.pointsEarned ?? 0;
    if (p.outcome === PickOutcome.WIN) wins += 1;
    else if (p.outcome === PickOutcome.LOSS) losses += 1;
    else if (p.outcome === PickOutcome.TIE) ties += 1;
  }

  return { entries, totalPoints, wins, losses, ties };
}
