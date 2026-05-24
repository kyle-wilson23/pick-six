import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/integrations/api-sports-nfl/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/api-sports-nfl/client")>();
  return { ...actual, fetchNflGamesForSeason: vi.fn() };
});

import { ApiSportsNflError, fetchNflGamesForSeason } from "@/lib/integrations/api-sports-nfl/client";
import { syncNflScheduleFromApiSports } from "./sync-nfl-schedule";

const mockFetch = vi.mocked(fetchNflGamesForSeason);

const TEAMS = [
  { id: "team-kc", abbreviation: "KC", name: "Kansas City Chiefs" },
  { id: "team-buf", abbreviation: "BUF", name: "Buffalo Bills" },
];

const SAMPLE_ENVELOPE = {
  response: [
    {
      game: { id: 1, stage: "Regular Season", week: "1", date: { timestamp: 1700000000 } },
      teams: { home: { code: "KC", name: "Kansas City Chiefs" }, away: { code: "BUF", name: "Buffalo Bills" } },
    },
  ],
};

function makePrisma(upsertFn = vi.fn().mockResolvedValue({})) {
  return {
    team: { findMany: vi.fn().mockResolvedValue(TEAMS) },
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({ nflGame: { upsert: upsertFn } }),
    ),
  } as unknown as PrismaClient;
}

describe("syncNflScheduleFromApiSports", () => {
  it("returns upserted count on success", async () => {
    mockFetch.mockResolvedValueOnce(SAMPLE_ENVELOPE as never);
    const result = await syncNflScheduleFromApiSports(makePrisma(), { apiKey: "key", nflSeasonYear: 2026 });
    expect(result).toEqual({ ok: true, upserted: 1 });
  });

  it("upsert update block only sets kickoffAt (NflGameOddsLine FK safety)", async () => {
    mockFetch.mockResolvedValueOnce(SAMPLE_ENVELOPE as never);
    const upsertFn = vi.fn().mockResolvedValue({});
    await syncNflScheduleFromApiSports(makePrisma(upsertFn), { apiKey: "key", nflSeasonYear: 2026 });
    expect(upsertFn).toHaveBeenCalledOnce();
    const call = upsertFn.mock.calls[0][0] as { update: Record<string, unknown> };
    expect(Object.keys(call.update)).toEqual(["kickoffAt"]);
  });

  it("returns PROVIDER_ERROR for ApiSportsNflError", async () => {
    mockFetch.mockRejectedValueOnce(new ApiSportsNflError("upstream fail", 503));
    const result = await syncNflScheduleFromApiSports(makePrisma(), { apiKey: "key", nflSeasonYear: 2026 });
    expect(result).toMatchObject({ ok: false, code: "PROVIDER_ERROR", httpStatus: 503 });
  });

  it("returns INTERNAL_ERROR for unexpected DB errors", async () => {
    mockFetch.mockResolvedValueOnce(SAMPLE_ENVELOPE as never);
    const prisma = {
      team: { findMany: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) },
      $transaction: vi.fn(),
    } as unknown as PrismaClient;
    const result = await syncNflScheduleFromApiSports(prisma, { apiKey: "key", nflSeasonYear: 2026 });
    expect(result).toMatchObject({ ok: false, code: "INTERNAL_ERROR", httpStatus: 500 });
  });

  it("returns NO_REGULAR_SEASON_GAMES (422) when provider has no regular-season rows", async () => {
    mockFetch.mockResolvedValueOnce({
      response: [
        {
          game: { id: 2, stage: "Pre Season", week: "2", date: { timestamp: 1700000001 } },
          teams: { home: { code: "KC", name: "Kansas City Chiefs" }, away: { code: "BUF", name: "Buffalo Bills" } },
        },
      ],
    } as never);
    const result = await syncNflScheduleFromApiSports(makePrisma(), { apiKey: "key", nflSeasonYear: 2026 });
    expect(result).toMatchObject({ ok: false, code: "NO_REGULAR_SEASON_GAMES", httpStatus: 422 });
  });
});
