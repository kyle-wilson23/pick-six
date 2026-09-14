import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/nfl/sync-nfl-results-from-odds", () => ({
  syncNflResultsFromOdds: vi.fn(),
}));

vi.mock("@/lib/scoring/finalize-nfl-week", () => ({
  finalizeNflWeek: vi.fn(),
}));

vi.mock("@/lib/nfl/snapshot-nfl-week-odds", () => ({
  snapshotNflWeekOddsFromProvider: vi.fn(),
}));

vi.mock("@/lib/nfl/jailed-computation", () => ({
  computeAndPersistNflWeekJailed: vi.fn(),
}));

import { computeAndPersistNflWeekJailed } from "@/lib/nfl/jailed-computation";
import { snapshotNflWeekOddsFromProvider } from "@/lib/nfl/snapshot-nfl-week-odds";
import { syncNflResultsFromOdds } from "@/lib/nfl/sync-nfl-results-from-odds";
import { finalizeNflWeek } from "@/lib/scoring/finalize-nfl-week";

import { finalizeClosedWeekAfterResultsSync, runWeekClose } from "./run-week-close";

const syncMock = vi.mocked(syncNflResultsFromOdds);
const finalizeMock = vi.mocked(finalizeNflWeek);
const snapshotMock = vi.mocked(snapshotNflWeekOddsFromProvider);
const jailedMock = vi.mocked(computeAndPersistNflWeekJailed);

const WEEK1 = { weekNumber: 1, kickoffAt: new Date("2026-09-11T00:20:00.000Z") };
const WEEK2 = { weekNumber: 2, kickoffAt: new Date("2026-09-18T00:20:00.000Z") };
const MIDWEEK_TUE = new Date("2026-09-15T11:00:00.000Z");
const PRE_WEEK1 = new Date("2026-09-08T11:00:00.000Z");
const POST_SEASON = new Date("2027-01-10T12:00:00.000Z");

function prismaWithGames(games: Array<{ weekNumber: number; kickoffAt: Date }>): PrismaClient {
  return {
    nflGame: {
      findMany: vi.fn().mockResolvedValue(games),
    },
  } as unknown as PrismaClient;
}

describe("runWeekClose", () => {
  const prisma = prismaWithGames([WEEK1, WEEK2]);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.nflGame.findMany = vi.fn().mockResolvedValue([WEEK1, WEEK2]);
    syncMock.mockResolvedValue({ ok: true, synced: 12, skipped: 0 });
    finalizeMock.mockResolvedValue({
      ok: true,
      allGamesFinalized: true,
      finalCount: 16,
      notFinalCount: 0,
      scored: 10,
      skipped: 0,
    });
    snapshotMock.mockResolvedValue({
      ok: true,
      runId: "run-1",
      matchedGames: 16,
      totalGamesInWeek: 16,
    });
    jailedMock.mockResolvedValue({
      ok: true as const,
      result: { jailedTeamId: "team-kc" },
      row: {},
    } as Awaited<ReturnType<typeof computeAndPersistNflWeekJailed>>);
  });

  it("happy path: results → finalize closed → snapshot opening → jailed", async () => {
    const out = await runWeekClose(prisma, {
      apiKey: "k",
      nflSeasonYear: 2026,
      now: MIDWEEK_TUE,
    });

    expect(out.ok).toBe(true);
    expect(out.httpStatus).toBe(200);
    expect(out.closedWeek).toBe(1);
    expect(out.snapshotWeek).toBe(2);
    expect(syncMock).toHaveBeenCalledWith(prisma, { apiKey: "k", nflSeasonYear: 2026 });
    expect(finalizeMock).toHaveBeenCalledWith(prisma, { nflSeasonYear: 2026, weekNumber: 1 });
    expect(snapshotMock).toHaveBeenCalledWith(prisma, {
      nflSeasonYear: 2026,
      weekNumber: 2,
      apiKey: "k",
    });
    expect(jailedMock).toHaveBeenCalledWith(
      prisma,
      { nflSeasonYear: 2026, weekNumber: 2 },
      { via: "automation" },
    );
    expect(syncMock.mock.invocationCallOrder[0]).toBeLessThan(finalizeMock.mock.invocationCallOrder[0]);
    expect(finalizeMock.mock.invocationCallOrder[0]).toBeLessThan(
      snapshotMock.mock.invocationCallOrder[0],
    );
    expect(snapshotMock.mock.invocationCallOrder[0]).toBeLessThan(jailedMock.mock.invocationCallOrder[0]);
  });

  it("incomplete MNF: scoring skipped counts; still snapshot + jailed; 200", async () => {
    finalizeMock.mockResolvedValue({
      ok: true,
      allGamesFinalized: false,
      finalCount: 15,
      notFinalCount: 1,
      scored: 0,
      skipped: 0,
    });

    const out = await runWeekClose(prisma, {
      apiKey: "k",
      nflSeasonYear: 2026,
      now: MIDWEEK_TUE,
    });

    expect(out.ok).toBe(true);
    expect(out.httpStatus).toBe(200);
    expect(out.finalize).toMatchObject({ ok: true, allGamesFinalized: false, scored: 0 });
    expect(snapshotMock).toHaveBeenCalledOnce();
    expect(jailedMock).toHaveBeenCalledOnce();
  });

  it("results hard fail: skip finalize; still attempt snapshot + jailed; non-2xx", async () => {
    syncMock.mockResolvedValue({
      ok: false,
      code: "ODDS_API_ERROR",
      message: "upstream",
      httpStatus: 502,
    });

    const out = await runWeekClose(prisma, {
      apiKey: "k",
      nflSeasonYear: 2026,
      now: MIDWEEK_TUE,
    });

    expect(out.ok).toBe(false);
    expect(out.httpStatus).toBe(502);
    expect(out.finalize).toEqual({ skipped: true, reason: "results_failed" });
    expect(finalizeMock).not.toHaveBeenCalled();
    expect(snapshotMock).toHaveBeenCalledOnce();
    expect(jailedMock).toHaveBeenCalledOnce();
  });

  it("snapshot hard fail: skip jailed; non-2xx", async () => {
    snapshotMock.mockResolvedValue({
      ok: false,
      runId: "run-fail",
      code: "NO_MATCHING_ODDS",
      message: "none matched",
      httpStatus: 422,
    });

    const out = await runWeekClose(prisma, {
      apiKey: "k",
      nflSeasonYear: 2026,
      now: MIDWEEK_TUE,
    });

    expect(out.ok).toBe(false);
    expect(out.httpStatus).toBe(422);
    expect(out.jailed).toEqual({ skipped: true, reason: "snapshot_failed" });
    expect(jailedMock).not.toHaveBeenCalled();
    expect(finalizeMock).toHaveBeenCalledOnce();
  });

  it("week 1 not started: skip finalize; snapshot + jailed week 1", async () => {
    const out = await runWeekClose(prisma, {
      apiKey: "k",
      nflSeasonYear: 2026,
      now: PRE_WEEK1,
    });

    expect(out.closedWeek).toBeNull();
    expect(out.snapshotWeek).toBe(1);
    expect(out.finalize).toEqual({ skipped: true, reason: "no_closed_week" });
    expect(finalizeMock).not.toHaveBeenCalled();
    expect(snapshotMock).toHaveBeenCalledWith(prisma, {
      nflSeasonYear: 2026,
      weekNumber: 1,
      apiKey: "k",
    });
    expect(jailedMock).toHaveBeenCalledOnce();
    expect(out.httpStatus).toBe(200);
  });

  it("jailed hard fail: non-2xx after snapshot succeeded", async () => {
    jailedMock.mockResolvedValue({
      ok: false as const,
      error: {
        ok: false as const,
        code: "NO_COMPLETE_MONEYLINES",
        message: "incomplete lines",
        httpStatus: 400,
      },
    } as Awaited<ReturnType<typeof computeAndPersistNflWeekJailed>>);

    const out = await runWeekClose(prisma, {
      apiKey: "k",
      nflSeasonYear: 2026,
      now: MIDWEEK_TUE,
    });

    expect(out.ok).toBe(false);
    expect(out.httpStatus).toBe(400);
    expect(out.snapshot).toMatchObject({ ok: true });
    expect(out.jailed).toMatchObject({ ok: false, code: "NO_COMPLETE_MONEYLINES" });
  });

  it("season complete: finalize last week; skip snapshot + jailed", async () => {
    const out = await runWeekClose(prisma, {
      apiKey: "k",
      nflSeasonYear: 2026,
      now: POST_SEASON,
    });

    expect(out.closedWeek).toBe(2);
    expect(out.snapshotWeek).toBeNull();
    expect(finalizeMock).toHaveBeenCalledWith(prisma, { nflSeasonYear: 2026, weekNumber: 2 });
    expect(snapshotMock).not.toHaveBeenCalled();
    expect(jailedMock).not.toHaveBeenCalled();
    expect(out.snapshot).toEqual({ skipped: true, reason: "no_opening_week" });
    expect(out.httpStatus).toBe(200);
  });
});

describe("finalizeClosedWeekAfterResultsSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    finalizeMock.mockResolvedValue({
      ok: true,
      allGamesFinalized: true,
      finalCount: 16,
      notFinalCount: 0,
      scored: 10,
      skipped: 0,
    });
  });

  it("calls finalizeNflWeek for the closed week only", async () => {
    const prisma = {
      nflGame: {
        findMany: vi.fn().mockResolvedValue([WEEK1, WEEK2]),
      },
    } as unknown as PrismaClient;

    const out = await finalizeClosedWeekAfterResultsSync(prisma, 2026, MIDWEEK_TUE);
    expect(out.closedWeek).toBe(1);
    expect(finalizeMock).toHaveBeenCalledWith(prisma, { nflSeasonYear: 2026, weekNumber: 1 });
    expect(snapshotMock).not.toHaveBeenCalled();
    expect(jailedMock).not.toHaveBeenCalled();
  });
});
