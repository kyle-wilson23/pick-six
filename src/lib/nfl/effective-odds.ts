import type { Prisma, PrismaClient } from "@prisma/client";

export type EffectiveOddsLineRow = {
  homeMoneylineAmerican: number | null;
  awayMoneylineAmerican: number | null;
  homeSpreadPoints: Prisma.Decimal | null;
};

/**
 * Effective line for a game = row from the **most recently completed** snapshot run that included this game.
 * Supports partial provider snapshots and one-game manual patches (Story 3.2).
 */
export async function getEffectiveOddsLinesForWeek(
  prisma: PrismaClient | Prisma.TransactionClient,
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
      oddsSnapshotRun: { status: "COMPLETED" },
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
