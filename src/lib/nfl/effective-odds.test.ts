import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";

import { getEffectiveOddsLinesForWeek } from "./effective-odds";

type LineRow = {
  nflGameId: string;
  homeMoneylineAmerican: number | null;
  awayMoneylineAmerican: number | null;
  homeSpreadPoints: Prisma.Decimal | null;
  oddsSnapshotRun: { completedAt: Date | null };
};

function mockPrisma(games: { id: string }[], lines: LineRow[]): PrismaClient {
  return {
    nflGame: {
      findMany: async () => games,
    },
    nflGameOddsLine: {
      findMany: async () => lines,
    },
  } as unknown as PrismaClient;
}

describe("getEffectiveOddsLinesForWeek", () => {
  it("returns an empty map when there are no games for the week", async () => {
    const prisma = mockPrisma([], []);
    const out = await getEffectiveOddsLinesForWeek(prisma, 2026, 1);
    expect(out.size).toBe(0);
  });

  it("picks the line from the most recently completed snapshot run per game", async () => {
    const g1 = "game-1";
    const older = new Date("2026-09-01T12:00:00.000Z");
    const newer = new Date("2026-09-02T12:00:00.000Z");
    const prisma = mockPrisma(
      [{ id: g1 }],
      [
        {
          nflGameId: g1,
          homeMoneylineAmerican: -200,
          awayMoneylineAmerican: 170,
          homeSpreadPoints: new Prisma.Decimal(-3),
          oddsSnapshotRun: { completedAt: older },
        },
        {
          nflGameId: g1,
          homeMoneylineAmerican: -210,
          awayMoneylineAmerican: 180,
          homeSpreadPoints: new Prisma.Decimal(-3.5),
          oddsSnapshotRun: { completedAt: newer },
        },
      ],
    );
    const out = await getEffectiveOddsLinesForWeek(prisma, 2026, 1);
    expect(out.get(g1)?.homeMoneylineAmerican).toBe(-210);
    expect(out.get(g1)?.homeSpreadPoints?.toString()).toBe("-3.5");
  });

  it("when completedAt ties, the later row in iteration wins (>=)", async () => {
    const g1 = "game-1";
    const t = new Date("2026-09-01T12:00:00.000Z");
    const prisma = mockPrisma(
      [{ id: g1 }],
      [
        {
          nflGameId: g1,
          homeMoneylineAmerican: -100,
          awayMoneylineAmerican: 100,
          homeSpreadPoints: new Prisma.Decimal(-1),
          oddsSnapshotRun: { completedAt: t },
        },
        {
          nflGameId: g1,
          homeMoneylineAmerican: -110,
          awayMoneylineAmerican: 110,
          homeSpreadPoints: new Prisma.Decimal(-1.5),
          oddsSnapshotRun: { completedAt: t },
        },
      ],
    );
    const out = await getEffectiveOddsLinesForWeek(prisma, 2026, 1);
    expect(out.get(g1)?.homeMoneylineAmerican).toBe(-110);
  });

  it("resolves each game independently", async () => {
    const g1 = "a";
    const g2 = "b";
    const t1 = new Date("2026-09-01T00:00:00.000Z");
    const t2 = new Date("2026-09-03T00:00:00.000Z");
    const prisma = mockPrisma(
      [{ id: g1 }, { id: g2 }],
      [
        {
          nflGameId: g1,
          homeMoneylineAmerican: -150,
          awayMoneylineAmerican: 130,
          homeSpreadPoints: null,
          oddsSnapshotRun: { completedAt: t2 },
        },
        {
          nflGameId: g2,
          homeMoneylineAmerican: -300,
          awayMoneylineAmerican: 250,
          homeSpreadPoints: new Prisma.Decimal(-7),
          oddsSnapshotRun: { completedAt: t1 },
        },
      ],
    );
    const out = await getEffectiveOddsLinesForWeek(prisma, 2026, 5);
    expect(out.get(g1)?.homeMoneylineAmerican).toBe(-150);
    expect(out.get(g2)?.awayMoneylineAmerican).toBe(250);
  });
});
