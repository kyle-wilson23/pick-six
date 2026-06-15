import { describe, expect, it, vi } from "vitest";
import type { NflGameStatus, PrismaClient } from "@prisma/client";

import { finalizeNflWeek, isWeekFullyFinalized } from "./finalize-nfl-week";

vi.mock("@/lib/scoring/score-nfl-week", () => ({
  scoreNflWeek: vi.fn(),
}));

import { scoreNflWeek } from "@/lib/scoring/score-nfl-week";

const SEASON_YEAR = 2026;
const WEEK = 3;

function game(status: NflGameStatus) {
  return { status };
}

function makePrisma(games: Array<{ status: NflGameStatus }> = []) {
  return {
    nflGame: {
      findMany: vi.fn().mockResolvedValue(games),
    },
  } as unknown as PrismaClient;
}

describe("isWeekFullyFinalized", () => {
  it("returns true when all games are FINAL", () => {
    expect(isWeekFullyFinalized([game("FINAL"), game("FINAL")])).toBe(true);
  });

  it("returns true when all games are CANCELLED", () => {
    expect(isWeekFullyFinalized([game("CANCELLED"), game("CANCELLED")])).toBe(true);
  });

  it("returns true when games are mixed FINAL and CANCELLED", () => {
    expect(isWeekFullyFinalized([game("FINAL"), game("CANCELLED")])).toBe(true);
  });

  it("returns false when any game is IN_PROGRESS", () => {
    expect(isWeekFullyFinalized([game("FINAL"), game("IN_PROGRESS")])).toBe(false);
  });

  it("returns false when any game is SCHEDULED", () => {
    expect(isWeekFullyFinalized([game("FINAL"), game("SCHEDULED")])).toBe(false);
  });

  it("returns true for an empty array", () => {
    expect(isWeekFullyFinalized([])).toBe(true);
  });
});

describe("finalizeNflWeek", () => {
  it("returns early without scoring when not all games are finalized", async () => {
    vi.mocked(scoreNflWeek).mockClear();
    const prisma = makePrisma([
      game("FINAL"),
      game("FINAL"),
      game("IN_PROGRESS"),
    ]);

    const result = await finalizeNflWeek(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
    });

    expect(result).toEqual({
      ok: true,
      allGamesFinalized: false,
      finalCount: 2,
      notFinalCount: 1,
      scored: 0,
      skipped: 0,
    });
    expect(vi.mocked(scoreNflWeek)).not.toHaveBeenCalled();
  });

  it("calls scoreNflWeek and returns scored counts when all games are finalized", async () => {
    vi.mocked(scoreNflWeek).mockClear();
    const prisma = makePrisma([
      game("FINAL"),
      game("FINAL"),
      game("CANCELLED"),
    ]);
    vi.mocked(scoreNflWeek).mockResolvedValueOnce({
      ok: true,
      scored: 14,
      skipped: 2,
    });

    const result = await finalizeNflWeek(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
    });

    expect(result).toEqual({
      ok: true,
      allGamesFinalized: true,
      finalCount: 3,
      notFinalCount: 0,
      scored: 14,
      skipped: 2,
    });
    expect(vi.mocked(scoreNflWeek)).toHaveBeenCalledOnce();
    expect(vi.mocked(scoreNflWeek)).toHaveBeenCalledWith(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
    });
  });

  it("calls scoreNflWeek when no games exist in DB for the week", async () => {
    vi.mocked(scoreNflWeek).mockClear();
    const prisma = makePrisma([]);
    vi.mocked(scoreNflWeek).mockResolvedValueOnce({
      ok: true,
      scored: 0,
      skipped: 0,
    });

    const result = await finalizeNflWeek(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
    });

    expect(result).toEqual({
      ok: true,
      allGamesFinalized: true,
      finalCount: 0,
      notFinalCount: 0,
      scored: 0,
      skipped: 0,
    });
    expect(vi.mocked(scoreNflWeek)).toHaveBeenCalledOnce();
  });

  it("propagates scoreNflWeek errors", async () => {
    vi.mocked(scoreNflWeek).mockClear();
    const prisma = makePrisma([game("FINAL")]);
    vi.mocked(scoreNflWeek).mockResolvedValueOnce({
      ok: false,
      code: "SCORE_ERROR",
      message: "Database unavailable",
      httpStatus: 503,
    });

    const result = await finalizeNflWeek(prisma, {
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

  it("is idempotent on re-run", async () => {
    vi.mocked(scoreNflWeek).mockClear();
    const prisma = makePrisma([game("FINAL"), game("FINAL")]);
    vi.mocked(scoreNflWeek).mockResolvedValue({
      ok: true,
      scored: 10,
      skipped: 1,
    });

    const first = await finalizeNflWeek(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
    });
    const second = await finalizeNflWeek(prisma, {
      nflSeasonYear: SEASON_YEAR,
      weekNumber: WEEK,
    });

    expect(first).toEqual(second);
    expect(vi.mocked(scoreNflWeek)).toHaveBeenCalledTimes(2);
  });
});
