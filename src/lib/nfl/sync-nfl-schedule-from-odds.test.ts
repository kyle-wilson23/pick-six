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

function buildFullSlateEvents(count: number) {
  const teams = Array.from({ length: 32 }, (_, i) => ({
    id: `t${i}`,
    abbreviation: `T${i}`,
    name: `Team ${i}`,
  }));
  const kickoff = new Date("2026-09-11T00:15:00.000Z");
  const events: Array<{
    id: string;
    sport_key: string;
    commence_time: string;
    home_team: string;
    away_team: string;
  }> = [];
  const used = new Set<string>();
  let n = 0;
  for (let w = 0; n < count && w < 30; w++) {
    for (let homeIdx = 0; n < count && homeIdx < 32; homeIdx++) {
      const awayIdx = (homeIdx + 1 + w) % 32;
      if (homeIdx === awayIdx) continue;
      const key = `${w}|${homeIdx}|${awayIdx}`;
      if (used.has(key)) continue;
      used.add(key);
      events.push({
        id: `e${n}`,
        sport_key: "americanfootball_nfl",
        commence_time: new Date(
          kickoff.getTime() + w * 7 * 24 * 60 * 60 * 1000 + homeIdx * 3600_000,
        ).toISOString(),
        home_team: teams[homeIdx]!.name,
        away_team: teams[awayIdx]!.name,
      });
      n++;
    }
  }
  return { teams, events };
}

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

  it("on a full slate, deletes orphans even when status is FINAL (seed leftovers)", async () => {
    const { teams, events } = buildFullSlateEvents(200);
    fetchEvents.mockResolvedValue(events);

    const upsert = vi.fn().mockResolvedValue({});
    const findManyGames = vi.fn().mockResolvedValue([
      {
        id: "orphan-final",
        weekNumber: 1,
        homeTeamId: "seed-h",
        awayTeamId: "seed-a",
        status: "FINAL",
      },
    ]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const prisma = {
      team: { findMany: vi.fn().mockResolvedValue(teams) },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
        await fn({ nflGame: { upsert, findMany: findManyGames, deleteMany } });
      }),
    };

    const result = await syncNflScheduleFromOdds(prisma as never, {
      apiKey: "k",
      nflSeasonYear: 2026,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.upserted).toBeGreaterThanOrEqual(200);
    expect(result.deleted).toBe(1);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["orphan-final"] } } });
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
