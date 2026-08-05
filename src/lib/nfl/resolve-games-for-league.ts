import type { NflGameStatus, Prisma, PrismaClient } from "@prisma/client";

import { ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } from "@/lib/nfl/apply-simulation-odds-snapshot";

export type LeagueGameSource = "canonical" | "sim";

/** Shared DTO for league week loaders — picks/email/admin should not import Prisma model unions. */
export type LeagueResolvedGame = {
  id: string;
  nflSeasonYear: number;
  weekNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: Date;
  status: NflGameStatus;
  homeScore: number | null;
  awayScore: number | null;
  finalizedAt: Date | null;
  source: LeagueGameSource;
};

export type LeagueResolvedTeam = {
  id: string;
  abbreviation: string;
  name: string;
};

export type LeagueResolvedGameWithTeams = LeagueResolvedGame & {
  homeTeam: LeagueResolvedTeam;
  awayTeam: LeagueResolvedTeam;
};

type Db = PrismaClient | Prisma.TransactionClient;

/** Same fixture-only predicate as cleanup: has test_fixture odds and no non-fixture odds. */
const FIXTURE_ONLY_ODDS_FILTER = {
  oddsLines: {
    some: {
      oddsSnapshotRun: { source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE },
    },
    none: {
      oddsSnapshotRun: { source: { not: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } },
    },
  },
} as const;

async function resolveIsTestLeague(
  prisma: Db,
  leagueId: string,
  known?: boolean,
): Promise<boolean> {
  if (known !== undefined) {
    return known;
  }
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { isTestLeague: true },
  });
  if (!league) {
    throw new Error(`League not found: ${leagueId}`);
  }
  return league.isTestLeague;
}

function mapCanonical(
  row: {
    id: string;
    nflSeasonYear: number;
    weekNumber: number;
    homeTeamId: string;
    awayTeamId: string;
    kickoffAt: Date;
    status: NflGameStatus;
    homeScore: number | null;
    awayScore: number | null;
    finalizedAt: Date | null;
  },
): LeagueResolvedGame {
  return { ...row, source: "canonical" };
}

function mapSim(
  row: {
    id: string;
    nflSeasonYear: number;
    weekNumber: number;
    homeTeamId: string;
    awayTeamId: string;
    kickoffAt: Date;
    status: NflGameStatus;
    homeScore: number | null;
    awayScore: number | null;
    finalizedAt: Date | null;
  },
): LeagueResolvedGame {
  return { ...row, source: "sim" };
}

/**
 * Single read seam for league schedule: real → canonical `NflGame`; test → that league’s `LeagueSimGame`.
 */
export async function resolveGamesForLeague(
  prisma: Db,
  params: {
    leagueId: string;
    nflSeasonYear: number;
    weekNumber?: number;
    /** Skip league lookup when already known. */
    isTestLeague?: boolean;
  },
): Promise<LeagueResolvedGame[]> {
  const isTest = await resolveIsTestLeague(prisma, params.leagueId, params.isTestLeague);
  const weekFilter =
    params.weekNumber !== undefined ? { weekNumber: params.weekNumber } : {};

  if (isTest) {
    const rows = await prisma.leagueSimGame.findMany({
      where: {
        leagueId: params.leagueId,
        nflSeasonYear: params.nflSeasonYear,
        ...weekFilter,
      },
      select: {
        id: true,
        nflSeasonYear: true,
        weekNumber: true,
        homeTeamId: true,
        awayTeamId: true,
        kickoffAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        finalizedAt: true,
      },
      orderBy: [{ weekNumber: "asc" }, { kickoffAt: "asc" }],
    });
    return rows.map(mapSim);
  }

  const rows = await prisma.nflGame.findMany({
    where: {
      nflSeasonYear: params.nflSeasonYear,
      ...weekFilter,
      // Defense until leftover fixture-only NflGame rows are purged.
      NOT: FIXTURE_ONLY_ODDS_FILTER,
    },
    select: {
      id: true,
      nflSeasonYear: true,
      weekNumber: true,
      homeTeamId: true,
      awayTeamId: true,
      kickoffAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
      finalizedAt: true,
    },
    orderBy: [{ weekNumber: "asc" }, { kickoffAt: "asc" }],
  });
  return rows.map(mapCanonical);
}

/** Same as {@link resolveGamesForLeague} with home/away team labels for UI/email. */
export async function resolveGamesForLeagueWithTeams(
  prisma: Db,
  params: {
    leagueId: string;
    nflSeasonYear: number;
    weekNumber?: number;
    isTestLeague?: boolean;
  },
): Promise<LeagueResolvedGameWithTeams[]> {
  const isTest = await resolveIsTestLeague(prisma, params.leagueId, params.isTestLeague);
  const weekFilter =
    params.weekNumber !== undefined ? { weekNumber: params.weekNumber } : {};
  const teamSelect = { id: true, abbreviation: true, name: true } as const;

  if (isTest) {
    const rows = await prisma.leagueSimGame.findMany({
      where: {
        leagueId: params.leagueId,
        nflSeasonYear: params.nflSeasonYear,
        ...weekFilter,
      },
      include: {
        homeTeam: { select: teamSelect },
        awayTeam: { select: teamSelect },
      },
      orderBy: [{ weekNumber: "asc" }, { kickoffAt: "asc" }],
    });
    return rows.map((r) => ({
      ...mapSim(r),
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
    }));
  }

  const rows = await prisma.nflGame.findMany({
    where: {
      nflSeasonYear: params.nflSeasonYear,
      ...weekFilter,
      NOT: FIXTURE_ONLY_ODDS_FILTER,
    },
    include: {
      homeTeam: { select: teamSelect },
      awayTeam: { select: teamSelect },
    },
    orderBy: [{ weekNumber: "asc" }, { kickoffAt: "asc" }],
  });
  return rows.map((r) => ({
    ...mapCanonical(r),
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
  }));
}
