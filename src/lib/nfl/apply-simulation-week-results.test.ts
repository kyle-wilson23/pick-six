import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NflGameStatus, PrismaClient } from "@prisma/client";

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
const LEAGUE_ID = "league-test-abc";

type MockGame = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  status: NflGameStatus;
};

function makePrisma(opts: {
  candidates?: MockGame[];
  update?: ReturnType<typeof vi.fn>;
  isTestLeague?: boolean;
  leagueMissing?: boolean;
}) {
  const update = opts.update ?? vi.fn().mockResolvedValue({});
  const tx = { leagueSimGame: { update } };

  return {
    league: {
      findUnique: vi.fn().mockResolvedValue(
        opts.leagueMissing ? null : { isTestLeague: opts.isTestLeague ?? true },
      ),
    },
    leagueSimGame: {
      findMany: vi.fn().mockResolvedValue(opts.candidates ?? []),
      update,
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(tx),
    ),
  } as unknown as PrismaClient & {
    leagueSimGame: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
}

describe("applySimulationWeekResults", () => {
  beforeEach(() => {
    vi.mocked(finalizeNflWeek).mockReset();
    vi.mocked(deriveFixtureGameResult).mockClear();
  });

  it("returns SIMULATION_GAMES_NOT_LOADED when no sim games with odds exist", async () => {
    const prisma = makePrisma({ candidates: [] });

    const result = await applySimulationWeekResults(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
      leagueId: LEAGUE_ID,
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
    expect(prisma.leagueSimGame.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leagueId: LEAGUE_ID,
          nflSeasonYear: SEASON_YEAR,
          weekNumber: WEEK,
          oddsLines: {
            some: {
              leagueSimOddsSnapshotRun: {
                status: "COMPLETED",
                source: "test_fixture",
              },
            },
          },
        }),
      }),
    );
  });

  it("refuses non-test leagues without writing", async () => {
    const prisma = makePrisma({ isTestLeague: false, candidates: [] });

    const result = await applySimulationWeekResults(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
      leagueId: LEAGUE_ID,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_TEST_LEAGUE",
      httpStatus: 403,
    });
    expect(prisma.leagueSimGame.findMany).not.toHaveBeenCalled();
    expect(vi.mocked(finalizeNflWeek)).not.toHaveBeenCalled();
  });

  it("never touches NflGame — only updates LeagueSimGame ids", async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = makePrisma({
      candidates: [
        {
          id: "sim-scheduled",
          homeTeamId: "home-fixture",
          awayTeamId: "away-fixture",
          status: "SCHEDULED",
        },
      ],
      update,
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
      leagueId: LEAGUE_ID,
    });

    expect(result.ok).toBe(true);
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0]![0]).toEqual(
      expect.objectContaining({ where: { id: "sim-scheduled" } }),
    );
    expect(JSON.stringify(update.mock.calls)).not.toContain("nflGame");
  });

  it("leaves already-FINAL sim games untouched and finalizes only SCHEDULED ones", async () => {
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
      leagueId: LEAGUE_ID,
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
      leagueId: LEAGUE_ID,
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
      leagueId: LEAGUE_ID,
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
      leagueId: LEAGUE_ID,
    });
  });
});
