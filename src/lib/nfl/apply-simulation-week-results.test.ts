import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NflGameStatus, PrismaClient } from "@prisma/client";

import { ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } from "@/lib/nfl/apply-simulation-odds-snapshot";
import { applySimulationWeekResults } from "@/lib/nfl/apply-simulation-week-results";

vi.mock("@/lib/scoring/finalize-nfl-week", () => ({
  finalizeNflWeek: vi.fn(),
}));

vi.mock("@/lib/domain/derive-fixture-game-result", () => ({
  deriveFixtureGameResult: vi.fn(({ homeTeamId }: { homeTeamId: string }) => ({
    homeScore: homeTeamId.includes("real") ? 99 : 24,
    awayScore: 17,
  })),
}));

import { finalizeNflWeek } from "@/lib/scoring/finalize-nfl-week";
import { deriveFixtureGameResult } from "@/lib/domain/derive-fixture-game-result";

const SEASON_YEAR = 2026;
const WEEK = 3;

type MockGame = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  status: NflGameStatus;
};

function makePrisma(opts: {
  candidates?: MockGame[];
  update?: ReturnType<typeof vi.fn>;
}) {
  const update = opts.update ?? vi.fn().mockResolvedValue({});
  const tx = { nflGame: { update } };

  return {
    nflGame: {
      findMany: vi.fn().mockResolvedValue(opts.candidates ?? []),
      update,
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(tx),
    ),
  } as unknown as PrismaClient & {
    nflGame: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
}

/**
 * Simulates a full `(year, week)` game slate (both fixture-provenance and real games) and applies
 * a mock `findMany` that only returns games flagged `hasFixtureOdds` — mirroring what the real
 * `oddsLines.some(...)` provenance filter would do at the DB layer. This lets a mocked-Prisma test
 * assert the orchestration never touches a real game's id, without requiring a real DB.
 */
function makePrismaWithMixedSlate(allGames: Array<MockGame & { hasFixtureOdds: boolean }>) {
  const update = vi.fn().mockResolvedValue({});
  const tx = { nflGame: { update } };
  const fixtureOnly = allGames.filter((g) => g.hasFixtureOdds);

  return {
    prisma: {
      nflGame: {
        findMany: vi.fn().mockResolvedValue(fixtureOnly),
        update,
      },
      $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as PrismaClient & {
      nflGame: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
      $transaction: ReturnType<typeof vi.fn>;
    },
    update,
  };
}

describe("applySimulationWeekResults", () => {
  beforeEach(() => {
    vi.mocked(finalizeNflWeek).mockReset();
    vi.mocked(deriveFixtureGameResult).mockClear();
  });

  it("returns SIMULATION_GAMES_NOT_LOADED when no fixture-odds games exist", async () => {
    const prisma = makePrisma({ candidates: [] });

    const result = await applySimulationWeekResults(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
    });

    expect(result).toEqual({
      ok: false,
      code: "SIMULATION_GAMES_NOT_LOADED",
      message:
        "No fixture games with odds have been applied for this week yet — apply an odds snapshot first.",
      httpStatus: 409,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(vi.mocked(finalizeNflWeek)).not.toHaveBeenCalled();

    // Provenance filter must be present on the findMany where clause.
    expect(prisma.nflGame.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          nflSeasonYear: SEASON_YEAR,
          weekNumber: WEEK,
          oddsLines: {
            some: {
              oddsSnapshotRun: {
                source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE,
              },
            },
          },
        }),
      }),
    );
  });

  it("never updates a real game sharing the same (year, week) as fixture candidates", async () => {
    // Simulates a mixed slate: a "real" NflGame row (no test_fixture odds line — would be
    // excluded by the actual `oddsLines.some(...)` where-clause) alongside a fixture-provenance
    // game. The mocked findMany applies that same fixture-only filter, so this proves the
    // orchestration's update/derive calls are driven entirely by the filtered candidate set and
    // never reach for the real game's id or team ids, however they made it into the raw slate.
    const { prisma, update } = makePrismaWithMixedSlate([
      {
        id: "real-game-1",
        homeTeamId: "real-home-team",
        awayTeamId: "real-away-team",
        status: "SCHEDULED",
        hasFixtureOdds: false,
      },
      {
        id: "fixture-scheduled",
        homeTeamId: "home-fixture",
        awayTeamId: "away-fixture",
        status: "SCHEDULED",
        hasFixtureOdds: true,
      },
    ]);
    vi.mocked(finalizeNflWeek).mockResolvedValueOnce({
      ok: true,
      allGamesFinalized: true,
      finalCount: 1,
      notFinalCount: 0,
      scored: 4,
      skipped: 0,
    });

    const result = await applySimulationWeekResults(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
    });

    expect(result.ok).toBe(true);
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0]![0]).toEqual(
      expect.objectContaining({ where: { id: "fixture-scheduled" } }),
    );
    expect(vi.mocked(deriveFixtureGameResult)).not.toHaveBeenCalledWith(
      expect.objectContaining({ homeTeamId: "real-home-team" }),
    );
    // The real game's id is never referenced by any update call.
    expect(JSON.stringify(update.mock.calls)).not.toContain("real-game-1");

    // Provenance filter is present on the findMany where clause — the actual DB-layer exclusion
    // of the real game (asserted above by simulation) relies on Prisma enforcing this clause.
    expect(prisma.nflGame.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          oddsLines: {
            some: {
              oddsSnapshotRun: {
                source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE,
              },
            },
          },
        }),
      }),
    );
  });

  it("leaves already-FINAL fixture games untouched and finalizes only SCHEDULED ones", async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = makePrisma({
      candidates: [
        {
          id: "already-final",
          homeTeamId: "home-a",
          awayTeamId: "away-a",
          status: "FINAL",
        },
        {
          id: "still-scheduled",
          homeTeamId: "home-b",
          awayTeamId: "away-b",
          status: "SCHEDULED",
        },
        {
          id: "cancelled-skip",
          homeTeamId: "home-c",
          awayTeamId: "away-c",
          status: "CANCELLED",
        },
      ],
      update,
    });
    vi.mocked(finalizeNflWeek).mockResolvedValueOnce({
      ok: true,
      allGamesFinalized: true,
      finalCount: 3,
      notFinalCount: 0,
      scored: 8,
      skipped: 1,
    });

    const result = await applySimulationWeekResults(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
    });

    expect(result).toEqual({
      ok: true,
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
      gamesInWeek: 3,
      gamesFinalizedThisRun: 1,
      allGamesFinalized: true,
      scored: 8,
      skipped: 1,
    });
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        where: { id: "still-scheduled" },
        data: expect.objectContaining({
          status: "FINAL",
          homeScore: 24,
          awayScore: 17,
          finalizedAt: expect.any(Date),
        }),
      }),
    );
    expect(vi.mocked(deriveFixtureGameResult)).toHaveBeenCalledWith({
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
      homeTeamId: "home-b",
      awayTeamId: "away-b",
    });
  });

  it("propagates finalizeNflWeek errors unchanged", async () => {
    const prisma = makePrisma({
      candidates: [
        {
          id: "g1",
          homeTeamId: "home-a",
          awayTeamId: "away-a",
          status: "SCHEDULED",
        },
      ],
    });
    vi.mocked(finalizeNflWeek).mockResolvedValueOnce({
      ok: false,
      code: "SCORE_ERROR",
      message: "Database unavailable",
      httpStatus: 503,
    });

    const result = await applySimulationWeekResults(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
    });

    expect(result).toEqual({
      ok: false,
      code: "SCORE_ERROR",
      message: "Database unavailable",
      httpStatus: 503,
    });
  });

  it("skips the transaction when all candidates are already FINAL (idempotent re-run)", async () => {
    const prisma = makePrisma({
      candidates: [
        {
          id: "already-final",
          homeTeamId: "home-a",
          awayTeamId: "away-a",
          status: "FINAL",
        },
      ],
    });
    vi.mocked(finalizeNflWeek).mockResolvedValueOnce({
      ok: true,
      allGamesFinalized: true,
      finalCount: 1,
      notFinalCount: 0,
      scored: 4,
      skipped: 0,
    });

    const result = await applySimulationWeekResults(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
    });

    expect(result).toMatchObject({
      ok: true,
      gamesInWeek: 1,
      gamesFinalizedThisRun: 0,
      scored: 4,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(vi.mocked(finalizeNflWeek)).toHaveBeenCalledWith(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
    });
  });
});
