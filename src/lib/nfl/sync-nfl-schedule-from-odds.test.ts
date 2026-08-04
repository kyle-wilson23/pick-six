import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/the-odds-api/client", () => ({
  TheOddsApiError: class TheOddsApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  fetchAmericanFootballNflEvents: vi.fn(),
}));

import { fetchAmericanFootballNflEvents } from "@/lib/integrations/the-odds-api/client";
import { syncNflScheduleFromOdds } from "./sync-nfl-schedule-from-odds";

const fetchEvents = vi.mocked(fetchAmericanFootballNflEvents);

describe("syncNflScheduleFromOdds", () => {
  beforeEach(() => {
    fetchEvents.mockReset();
  });

  it("returns mapping error without deleting when a team is unknown", async () => {
    fetchEvents.mockResolvedValue([
      {
        id: "e1",
        sport_key: "americanfootball_nfl",
        commence_time: "2026-09-11T00:15:00Z",
        home_team: "Philadelphia Eagles",
        away_team: "Atlantis Atlanteans",
      },
    ]);

    const prisma = {
      team: {
        findMany: vi.fn().mockResolvedValue([
          { id: "phi", abbreviation: "PHI", name: "Philadelphia Eagles" },
        ]),
      },
      $transaction: vi.fn(),
    };

    const result = await syncNflScheduleFromOdds(prisma as never, {
      apiKey: "k",
      nflSeasonYear: 2026,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("SCHEDULE_MAPPING_ERROR");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("upserts a small slate without orphan delete (partial /events feed)", async () => {
    fetchEvents.mockResolvedValue([
      {
        id: "e1",
        sport_key: "americanfootball_nfl",
        commence_time: "2026-09-11T00:15:00Z",
        home_team: "Philadelphia Eagles",
        away_team: "Dallas Cowboys",
      },
    ]);

    const upsert = vi.fn().mockResolvedValue({});
    const findManyGames = vi.fn();
    const deleteMany = vi.fn();

    const prisma = {
      team: {
        findMany: vi.fn().mockResolvedValue([
          { id: "phi", abbreviation: "PHI", name: "Philadelphia Eagles" },
          { id: "dal", abbreviation: "DAL", name: "Dallas Cowboys" },
        ]),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
        await fn({
          nflGame: { upsert, findMany: findManyGames, deleteMany },
        });
      }),
    };

    const result = await syncNflScheduleFromOdds(prisma as never, {
      apiKey: "k",
      nflSeasonYear: 2026,
    });
    expect(result).toEqual({ ok: true, upserted: 1, deleted: 0 });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
