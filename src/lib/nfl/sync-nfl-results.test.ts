import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/integrations/api-sports-nfl/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/api-sports-nfl/client")>();
  return { ...actual, fetchNflGamesForSeason: vi.fn() };
});

import { fetchNflGamesForSeason } from "@/lib/integrations/api-sports-nfl/client";
import { syncNflResultsFromApiSports } from "./sync-nfl-results";

const mockFetch = vi.mocked(fetchNflGamesForSeason);

const TEAMS = [
  { id: "team-kc", abbreviation: "KC", name: "Kansas City Chiefs" },
  { id: "team-buf", abbreviation: "BUF", name: "Buffalo Bills" },
];

const FT_GAME = {
  game: {
    id: 1,
    stage: "Regular Season",
    week: "1",
    status: { short: "FT" },
  },
  teams: { home: { code: "KC", name: "Kansas City Chiefs" }, away: { code: "BUF", name: "Buffalo Bills" } },
  scores: { home: { total: 27 }, away: { total: 20 } },
};

const IN_PROGRESS_GAME = {
  game: {
    id: 2,
    stage: "Regular Season",
    week: "1",
    status: { short: "Q3" },
  },
  teams: { home: { code: "KC", name: "Kansas City Chiefs" }, away: { code: "BUF", name: "Buffalo Bills" } },
  scores: { home: { total: 14 }, away: { total: 10 } },
};

function makePrisma({
  findUnique = vi.fn(),
  update = vi.fn().mockResolvedValue({}),
}: {
  findUnique?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    team: { findMany: vi.fn().mockResolvedValue(TEAMS) },
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({ nflGame: { findUnique, update } }),
    ),
  } as unknown as PrismaClient;
}

describe("syncNflResultsFromApiSports", () => {
  it("updates FINAL game with all result fields and sets finalizedAt on first transition", async () => {
    mockFetch.mockResolvedValueOnce({ response: [FT_GAME] } as never);
    const findUnique = vi.fn().mockResolvedValue({ id: "game-1", status: "SCHEDULED" });
    const update = vi.fn().mockResolvedValue({});
    await syncNflResultsFromApiSports(makePrisma({ findUnique, update }), {
      apiKey: "key",
      nflSeasonYear: 2026,
      weekNumber: 1,
    });
    expect(update).toHaveBeenCalledOnce();
    const data = update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe("FINAL");
    expect(data.homeScore).toBe(27);
    expect(data.awayScore).toBe(20);
    expect(data.finalizedAt).toBeInstanceOf(Date);
  });

  it("does not overwrite finalizedAt when game is already FINAL", async () => {
    mockFetch.mockResolvedValueOnce({ response: [FT_GAME] } as never);
    const findUnique = vi.fn().mockResolvedValue({ id: "game-1", status: "FINAL" });
    const update = vi.fn().mockResolvedValue({});
    await syncNflResultsFromApiSports(makePrisma({ findUnique, update }), {
      apiKey: "key",
      nflSeasonYear: 2026,
      weekNumber: 1,
    });
    const data = update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.finalizedAt).toBeUndefined();
  });

  it("updates IN_PROGRESS status and scores without finalizedAt", async () => {
    mockFetch.mockResolvedValueOnce({ response: [IN_PROGRESS_GAME] } as never);
    const findUnique = vi.fn().mockResolvedValue({ id: "game-1", status: "SCHEDULED" });
    const update = vi.fn().mockResolvedValue({});
    await syncNflResultsFromApiSports(makePrisma({ findUnique, update }), {
      apiKey: "key",
      nflSeasonYear: 2026,
      weekNumber: 1,
    });
    const data = update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe("IN_PROGRESS");
    expect(data.homeScore).toBe(14);
    expect(data.awayScore).toBe(10);
    expect(data.finalizedAt).toBeUndefined();
  });

  it("is idempotent when re-running FINAL sync with same data", async () => {
    mockFetch.mockResolvedValueOnce({ response: [FT_GAME] } as never);
    const findUnique = vi.fn().mockResolvedValue({ id: "game-1", status: "FINAL" });
    const update = vi.fn().mockResolvedValue({});
    const result = await syncNflResultsFromApiSports(makePrisma({ findUnique, update }), {
      apiKey: "key",
      nflSeasonYear: 2026,
      weekNumber: 1,
    });
    expect(result).toEqual({ ok: true, synced: 1, skipped: 0 });
    const data = update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe("FINAL");
    expect(data.homeScore).toBe(27);
    expect(data.awayScore).toBe(20);
    expect(data.finalizedAt).toBeUndefined();
  });

  it("season-wide sync (no weekNumber) syncs weeks with completed games and skips others", async () => {
    const week2FtGame = {
      game: { id: 4, stage: "Regular Season", week: "2", status: { short: "FT" } },
      teams: { home: { code: "KC", name: "Kansas City Chiefs" }, away: { code: "BUF", name: "Buffalo Bills" } },
      scores: { home: { total: 17 }, away: { total: 14 } },
    };
    const week3InProgressGame = {
      game: { id: 5, stage: "Regular Season", week: "3", status: { short: "Q2" } },
      teams: { home: { code: "KC", name: "Kansas City Chiefs" }, away: { code: "BUF", name: "Buffalo Bills" } },
      scores: { home: { total: 7 }, away: { total: 0 } },
    };
    mockFetch.mockResolvedValueOnce({ response: [week2FtGame, week3InProgressGame] } as never);
    const findUnique = vi.fn().mockResolvedValue({ id: "game-2", status: "SCHEDULED" });
    const update = vi.fn().mockResolvedValue({});
    const result = await syncNflResultsFromApiSports(makePrisma({ findUnique, update }), {
      apiKey: "key",
      nflSeasonYear: 2026,
    });
    expect(result).toEqual({ ok: true, synced: 1, skipped: 0 });
    expect(update).toHaveBeenCalledOnce();
    const data = update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe("FINAL");
  });

  it("logs match failure for unknown teams and continues with other games", async () => {
    const unknownTeamsGame = {
      game: { id: 3, stage: "Regular Season", week: "1", status: { short: "FT" } },
      teams: { home: { code: "UNK" }, away: { code: "ZZZ" } },
      scores: { home: { total: 3 }, away: { total: 0 } },
    };
    mockFetch.mockResolvedValueOnce({ response: [FT_GAME, unknownTeamsGame] } as never);
    const findUnique = vi.fn().mockResolvedValue({ id: "game-1", status: "SCHEDULED" });
    const update = vi.fn().mockResolvedValue({});
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await syncNflResultsFromApiSports(makePrisma({ findUnique, update }), {
      apiKey: "key",
      nflSeasonYear: 2026,
      weekNumber: 1,
    });
    expect(result).toEqual({ ok: true, synced: 1, skipped: 1 });
    expect(update).toHaveBeenCalledOnce();
    const logged = consoleSpy.mock.calls.some((c) =>
      String(c[0]).includes("nfl_results_sync_match_failure"),
    );
    expect(logged).toBe(true);
    consoleSpy.mockRestore();
  });
});
