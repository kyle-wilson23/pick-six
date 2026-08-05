import type { Prisma, PrismaClient } from "@prisma/client";

export type EffectiveOddsLineRow = {
  homeMoneylineAmerican: number | null;
  awayMoneylineAmerican: number | null;
  homeSpreadPoints: Prisma.Decimal | null;
};

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Effective line for a canonical game = row from the **most recently completed** snapshot run
 * that included this game. Supports partial provider snapshots and one-game manual patches (Story 3.2).
 */
export async function getEffectiveOddsLinesForWeek(
  prisma: Db,
  nflSeasonYear: number,
  weekNumber: number,
): Promise<Map<string, EffectiveOddsLineRow>> {
  const games = await prisma.nflGame.findMany({
    where: { nflSeasonYear, weekNumber },
    select: { id: true },
  });
  const ids = games.map((g) => g.id);
  if (ids.length === 0) {
    return new Map();
  }

  const all = await prisma.nflGameOddsLine.findMany({
    where: {
      nflGameId: { in: ids },
      oddsSnapshotRun: {
        status: "COMPLETED",
        // Leftover rehearsal fixture snapshots must never become canonical effective odds.
        // (Same stamp as ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE — inlined to avoid import cycles.)
        source: { not: "test_fixture" },
      },
    },
    include: {
      oddsSnapshotRun: { select: { completedAt: true } },
    },
  });


  const best = new Map<string, (typeof all)[number]>();
  for (const line of all) {
    const prev = best.get(line.nflGameId);
    const t = line.oddsSnapshotRun.completedAt?.getTime() ?? 0;
    const pt = prev?.oddsSnapshotRun.completedAt?.getTime() ?? 0;
    if (!prev || t >= pt) {
      best.set(line.nflGameId, line);
    }
  }

  const out = new Map<string, EffectiveOddsLineRow>();
  for (const [gameId, line] of best) {
    out.set(gameId, {
      homeMoneylineAmerican: line.homeMoneylineAmerican,
      awayMoneylineAmerican: line.awayMoneylineAmerican,
      homeSpreadPoints: line.homeSpreadPoints,
    });
  }
  return out;
}

/**
 * Effective lines for a test league’s sim games (latest completed `LeagueSimOddsSnapshotRun` per game).
 */
export async function getEffectiveOddsLinesForSimWeek(
  prisma: Db,
  params: { leagueId: string; nflSeasonYear: number; weekNumber: number },
): Promise<Map<string, EffectiveOddsLineRow>> {
  const games = await prisma.leagueSimGame.findMany({
    where: {
      leagueId: params.leagueId,
      nflSeasonYear: params.nflSeasonYear,
      weekNumber: params.weekNumber,
    },
    select: { id: true },
  });
  const ids = games.map((g) => g.id);
  if (ids.length === 0) {
    return new Map();
  }

  const all = await prisma.leagueSimGameOddsLine.findMany({
    where: {
      leagueSimGameId: { in: ids },
      leagueSimOddsSnapshotRun: { status: "COMPLETED" },
    },
    include: {
      leagueSimOddsSnapshotRun: { select: { completedAt: true } },
    },
  });

  const best = new Map<string, (typeof all)[number]>();
  for (const line of all) {
    const prev = best.get(line.leagueSimGameId);
    const t = line.leagueSimOddsSnapshotRun.completedAt?.getTime() ?? 0;
    const pt = prev?.leagueSimOddsSnapshotRun.completedAt?.getTime() ?? 0;
    if (!prev || t >= pt) {
      best.set(line.leagueSimGameId, line);
    }
  }

  const out = new Map<string, EffectiveOddsLineRow>();
  for (const [gameId, line] of best) {
    out.set(gameId, {
      homeMoneylineAmerican: line.homeMoneylineAmerican,
      awayMoneylineAmerican: line.awayMoneylineAmerican,
      homeSpreadPoints: line.homeSpreadPoints,
    });
  }
  return out;
}

/** Branching reader: real → canonical lines; test → sim lines for that league. */
export async function getEffectiveOddsLinesForLeague(
  prisma: Db,
  params: {
    leagueId: string;
    nflSeasonYear: number;
    weekNumber: number;
    isTestLeague: boolean;
  },
): Promise<Map<string, EffectiveOddsLineRow>> {
  if (params.isTestLeague) {
    return getEffectiveOddsLinesForSimWeek(prisma, {
      leagueId: params.leagueId,
      nflSeasonYear: params.nflSeasonYear,
      weekNumber: params.weekNumber,
    });
  }
  return getEffectiveOddsLinesForWeek(prisma, params.nflSeasonYear, params.weekNumber);
}
