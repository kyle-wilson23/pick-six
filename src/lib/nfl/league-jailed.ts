import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** Jailed team id for a league week: test → league-scoped; real → global. */
export async function getJailedTeamIdForLeagueWeek(
  prisma: Db,
  params: {
    leagueId: string;
    nflSeasonYear: number;
    weekNumber: number;
    isTestLeague: boolean;
  },
): Promise<string | null> {
  if (params.isTestLeague) {
    const row = await prisma.leagueWeekJailedTeam.findUnique({
      where: {
        leagueId_nflSeasonYear_weekNumber: {
          leagueId: params.leagueId,
          nflSeasonYear: params.nflSeasonYear,
          weekNumber: params.weekNumber,
        },
      },
      select: { jailedTeamId: true },
    });
    return row?.jailedTeamId ?? null;
  }

  const row = await prisma.nflWeekJailedTeam.findUnique({
    where: {
      nflSeasonYear_weekNumber: {
        nflSeasonYear: params.nflSeasonYear,
        weekNumber: params.weekNumber,
      },
    },
    select: { jailedTeamId: true },
  });
  return row?.jailedTeamId ?? null;
}

/** Jailed row with team label for email / admin surfaces. */
export async function getJailedWithTeamForLeagueWeek(
  prisma: Db,
  params: {
    leagueId: string;
    nflSeasonYear: number;
    weekNumber: number;
    isTestLeague: boolean;
  },
): Promise<{
  jailedTeamId: string;
  resolvedBy: string;
  randomSeed: string | null;
  auditJson: Prisma.JsonValue;
  computedAt: Date;
  jailedTeam: { id: string; name: string; abbreviation: string };
} | null> {
  const teamSelect = { id: true, name: true, abbreviation: true } as const;
  const select = {
    jailedTeamId: true,
    resolvedBy: true,
    randomSeed: true,
    auditJson: true,
    computedAt: true,
    jailedTeam: { select: teamSelect },
  } as const;

  if (params.isTestLeague) {
    return prisma.leagueWeekJailedTeam.findUnique({
      where: {
        leagueId_nflSeasonYear_weekNumber: {
          leagueId: params.leagueId,
          nflSeasonYear: params.nflSeasonYear,
          weekNumber: params.weekNumber,
        },
      },
      select,
    });
  }

  return prisma.nflWeekJailedTeam.findUnique({
    where: {
      nflSeasonYear_weekNumber: {
        nflSeasonYear: params.nflSeasonYear,
        weekNumber: params.weekNumber,
      },
    },
    select,
  });
}
