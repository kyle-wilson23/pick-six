import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/the-odds-api/client", () => ({
  TheOddsApiError: class TheOddsApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  fetchAmericanFootballNflScores: vi.fn(),
}));

import { fetchAmericanFootballNflScores } from "@/lib/integrations/the-odds-api/client";
import { syncNflResultsFromOdds } from "./sync-nfl-results-from-odds";

const fetchScores = vi.mocked(fetchAmericanFootballNflScores);

describe("syncNflResultsFromOdds", () => {
  beforeEach(() => {
    fetchScores.mockReset();
  });

  it("returns synced 0 when no completed scores yet", async () => {
    fetchScores.mockResolvedValue([
      {
        id: "live",
        sport_key: "americanfootball_nfl",
        commence_time: "2026-09-11T00:15:00Z",
        completed: false,
        home_team: "Philadelphia Eagles",
        away_team: "Dallas Cowboys",
        scores: null,
      },
    ]);

    const prisma = {
      team: {
        findMany: vi.fn().mockResolvedValue([
          { id: "phi", abbreviation: "PHI", name: "Philadelphia Eagles" },
          { id: "dal", abbreviation: "DAL", name: "Dallas Cowboys" },
        ]),
      },
      nflGame: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(),
    };

    const result = await syncNflResultsFromOdds(prisma as never, {
      apiKey: "k",
      nflSeasonYear: 2026,
    });
    expect(result).toEqual({ ok: true, synced: 0, skipped: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("sets FINAL scores and finalizedAt on first transition", async () => {
    fetchScores.mockResolvedValue([
      {
        id: "s1",
        sport_key: "americanfootball_nfl",
        commence_time: "2026-09-11T00:15:00Z",
        completed: true,
        home_team: "Philadelphia Eagles",
        away_team: "Dallas Cowboys",
        scores: [
          { name: "Philadelphia Eagles", score: "24" },
          { name: "Dallas Cowboys", score: "17" },
        ],
      },
    ]);

    const update = vi.fn().mockResolvedValue({});
    const findUnique = vi.fn().mockResolvedValue({ id: "game-1", status: "SCHEDULED" });

    const prisma = {
      team: {
        findMany: vi.fn().mockResolvedValue([
          { id: "phi", abbreviation: "PHI", name: "Philadelphia Eagles" },
          { id: "dal", abbreviation: "DAL", name: "Dallas Cowboys" },
        ]),
      },
      nflGame: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "game-1",
            weekNumber: 1,
            homeTeamId: "phi",
            awayTeamId: "dal",
            kickoffAt: new Date("2026-09-11T00:15:00Z"),
          },
        ]),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
        await fn({ nflGame: { findUnique, update } });
      }),
    };

    const result = await syncNflResultsFromOdds(prisma as never, {
      apiKey: "k",
      nflSeasonYear: 2026,
      weekNumber: 1,
    });
    expect(result).toEqual({ ok: true, synced: 1, skipped: 0 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "game-1" },
        data: expect.objectContaining({
          status: "FINAL",
          homeScore: 24,
          awayScore: 17,
          finalizedAt: expect.any(Date),
        }),
      }),
    );
  });
});
