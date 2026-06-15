import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { scoreNflWeek } from "./score-nfl-week";

const HOME = "team-home";
const AWAY = "team-away";
const OTHER = "team-other";
const SEASON_YEAR = 2026;
const WEEK = 1;

type MockPick = { id: string; teamId: string; antiJailedBonus: boolean };

function makePrisma({
  finalGames = [],
  picks = [],
  pickUpdate = vi.fn().mockResolvedValue({}),
}: {
  finalGames?: Array<{
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number | null;
    awayScore: number | null;
  }>;
  picks?: MockPick[];
  pickUpdate?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    nflGame: {
      findMany: vi.fn().mockResolvedValue(finalGames),
    },
    pick: {
      findMany: vi.fn().mockResolvedValue(picks),
    },
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({ pick: { update: pickUpdate } }),
    ),
  } as unknown as PrismaClient;
}

const FINAL_HOME_WIN = {
  homeTeamId: HOME,
  awayTeamId: AWAY,
  homeScore: 27,
  awayScore: 20,
};

describe("scoreNflWeek", () => {
  it("scores standard win as WIN/1pt and sets scoredAt", async () => {
    const pickUpdate = vi.fn().mockResolvedValue({});
    const result = await scoreNflWeek(
      makePrisma({
        finalGames: [FINAL_HOME_WIN],
        picks: [{ id: "pick-1", teamId: HOME, antiJailedBonus: false }],
        pickUpdate,
      }),
      { nflSeasonYear: SEASON_YEAR, weekNumber: WEEK },
    );

    expect(result).toEqual({ ok: true, scored: 1, skipped: 0 });
    expect(pickUpdate).toHaveBeenCalledOnce();
    const data = pickUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.outcome).toBe("WIN");
    expect(data.pointsEarned).toBe(1);
    expect(data.scoredAt).toBeInstanceOf(Date);
  });

  it("scores anti-jailed win as WIN/2pt", async () => {
    const pickUpdate = vi.fn().mockResolvedValue({});
    await scoreNflWeek(
      makePrisma({
        finalGames: [{ homeTeamId: HOME, awayTeamId: AWAY, homeScore: 14, awayScore: 21 }],
        picks: [{ id: "pick-1", teamId: AWAY, antiJailedBonus: true }],
        pickUpdate,
      }),
      { nflSeasonYear: SEASON_YEAR, weekNumber: WEEK },
    );

    const data = pickUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.outcome).toBe("WIN");
    expect(data.pointsEarned).toBe(2);
  });

  it("scores loss as LOSS/0pt", async () => {
    const pickUpdate = vi.fn().mockResolvedValue({});
    await scoreNflWeek(
      makePrisma({
        finalGames: [FINAL_HOME_WIN],
        picks: [{ id: "pick-1", teamId: AWAY, antiJailedBonus: false }],
        pickUpdate,
      }),
      { nflSeasonYear: SEASON_YEAR, weekNumber: WEEK },
    );

    const data = pickUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.outcome).toBe("LOSS");
    expect(data.pointsEarned).toBe(0);
  });

  it("scores tie as TIE/0pt", async () => {
    const pickUpdate = vi.fn().mockResolvedValue({});
    await scoreNflWeek(
      makePrisma({
        finalGames: [{ homeTeamId: HOME, awayTeamId: AWAY, homeScore: 24, awayScore: 24 }],
        picks: [{ id: "pick-1", teamId: HOME, antiJailedBonus: true }],
        pickUpdate,
      }),
      { nflSeasonYear: SEASON_YEAR, weekNumber: WEEK },
    );

    const data = pickUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.outcome).toBe("TIE");
    expect(data.pointsEarned).toBe(0);
  });

  it("skips picks whose game is not FINAL", async () => {
    const pickUpdate = vi.fn().mockResolvedValue({});
    const result = await scoreNflWeek(
      makePrisma({
        finalGames: [],
        picks: [{ id: "pick-1", teamId: HOME, antiJailedBonus: false }],
        pickUpdate,
      }),
      { nflSeasonYear: SEASON_YEAR, weekNumber: WEEK },
    );

    expect(result).toEqual({ ok: true, scored: 0, skipped: 1 });
    expect(pickUpdate).not.toHaveBeenCalled();
  });

  it("returns scored 0 and skipped N when no FINAL games exist", async () => {
    const pickUpdate = vi.fn().mockResolvedValue({});
    const result = await scoreNflWeek(
      makePrisma({
        finalGames: [],
        picks: [
          { id: "pick-1", teamId: HOME, antiJailedBonus: false },
          { id: "pick-2", teamId: AWAY, antiJailedBonus: false },
        ],
        pickUpdate,
      }),
      { nflSeasonYear: SEASON_YEAR, weekNumber: WEEK },
    );

    expect(result).toEqual({ ok: true, scored: 0, skipped: 2 });
    expect(pickUpdate).not.toHaveBeenCalled();
  });

  it("is idempotent on re-run and updates scoredAt", async () => {
    vi.useFakeTimers();
    const pickUpdate = vi.fn().mockResolvedValue({});
    const prisma = makePrisma({
      finalGames: [FINAL_HOME_WIN],
      picks: [{ id: "pick-1", teamId: HOME, antiJailedBonus: false }],
      pickUpdate,
    });

    const t1 = new Date("2026-06-14T12:00:00Z");
    vi.setSystemTime(t1);
    const first = await scoreNflWeek(prisma, { nflSeasonYear: SEASON_YEAR, weekNumber: WEEK });

    const t2 = new Date("2026-06-14T12:01:00Z");
    vi.setSystemTime(t2);
    const second = await scoreNflWeek(prisma, { nflSeasonYear: SEASON_YEAR, weekNumber: WEEK });

    expect(first).toEqual({ ok: true, scored: 1, skipped: 0 });
    expect(second).toEqual({ ok: true, scored: 1, skipped: 0 });
    expect(pickUpdate).toHaveBeenCalledTimes(2);
    const firstScoredAt = pickUpdate.mock.calls[0][0].data.scoredAt as Date;
    const secondScoredAt = pickUpdate.mock.calls[1][0].data.scoredAt as Date;
    expect(firstScoredAt).toEqual(t1);
    expect(secondScoredAt).toEqual(t2);
    expect(secondScoredAt.getTime()).toBeGreaterThan(firstScoredAt.getTime());

    vi.useRealTimers();
  });

  it("scores multiple picks across leagues independently", async () => {
    const pickUpdate = vi.fn().mockResolvedValue({});
    const result = await scoreNflWeek(
      makePrisma({
        finalGames: [
          FINAL_HOME_WIN,
          { homeTeamId: OTHER, awayTeamId: AWAY, homeScore: 10, awayScore: 17 },
        ],
        picks: [
          { id: "pick-1", teamId: HOME, antiJailedBonus: false },
          { id: "pick-2", teamId: AWAY, antiJailedBonus: true },
          { id: "pick-3", teamId: OTHER, antiJailedBonus: false },
        ],
        pickUpdate,
      }),
      { nflSeasonYear: SEASON_YEAR, weekNumber: WEEK },
    );

    expect(result).toEqual({ ok: true, scored: 3, skipped: 0 });
    expect(pickUpdate).toHaveBeenCalledTimes(3);

    const outcomes = pickUpdate.mock.calls.map((call) => {
      const data = call[0].data as { outcome: string; pointsEarned: number };
      return { outcome: data.outcome, pointsEarned: data.pointsEarned };
    });
    expect(outcomes).toContainEqual({ outcome: "WIN", pointsEarned: 1 });
    expect(outcomes).toContainEqual({ outcome: "WIN", pointsEarned: 2 });
    expect(outcomes).toContainEqual({ outcome: "LOSS", pointsEarned: 0 });
  });
});
