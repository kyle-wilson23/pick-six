import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { applySimulationOddsSnapshot } from "@/lib/nfl/apply-simulation-odds-snapshot";

vi.mock("@/lib/nfl/jailed-computation", () => ({
  computeAndPersistLeagueWeekJailed: vi.fn(),
}));

vi.mock("@/lib/nfl/simulation-fixture-schedule", () => ({
  selectFixtureMatchups: vi.fn(() => [
    { home: "KC", away: "BUF" },
    { home: "PHI", away: "DAL" },
  ]),
  buildFixtureKickoffTimes: vi.fn(() => [
    new Date("2026-09-14T17:00:00.000Z"),
    new Date("2026-09-14T20:00:00.000Z"),
  ]),
}));

vi.mock("@/lib/domain/derive-fixture-odds-line", () => ({
  deriveFixtureOddsLine: vi.fn(() => ({
    homeMoneylineAmerican: 1.67,
    awayMoneylineAmerican: 2.3,
    homeSpreadPoints: -3,
  })),
}));

import { computeAndPersistLeagueWeekJailed } from "@/lib/nfl/jailed-computation";

const LEAGUE_ID = "test-league-a";
const YEAR = 2026;
const WEEK = 2;

describe("applySimulationOddsSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes only LeagueSimGame / sim odds — never upserts NflGame", async () => {
    const simUpsert = vi.fn().mockResolvedValue({});
    const nflUpsert = vi.fn();
    const createRun = vi.fn().mockResolvedValue({ id: "sim-run-1" });
    const createManyLines = vi.fn().mockResolvedValue({ count: 2 });

    const gamesAfterEnsure = [
      { id: "sim-g1", homeTeamId: "home-1", awayTeamId: "away-1" },
      { id: "sim-g2", homeTeamId: "home-2", awayTeamId: "away-2" },
    ];
    let findManyCalls = 0;
    const leagueSimGameFindMany = vi.fn().mockImplementation(() => {
      findManyCalls += 1;
      return Promise.resolve(findManyCalls === 1 ? [] : gamesAfterEnsure);
    });

    const prisma = {
      league: {
        findUnique: vi.fn().mockResolvedValue({ isTestLeague: true }),
      },
      leagueSimGame: {
        findMany: leagueSimGameFindMany,
        upsert: simUpsert,
      },
      nflGame: { findMany: vi.fn(), upsert: nflUpsert },
      team: {
        findMany: vi.fn().mockResolvedValue([
          { id: "home-1", abbreviation: "KC" },
          { id: "away-1", abbreviation: "BUF" },
          { id: "home-2", abbreviation: "PHI" },
          { id: "away-2", abbreviation: "DAL" },
        ]),
      },
      leagueSimOddsSnapshotRun: { create: createRun },
      leagueSimGameOddsLine: { createMany: createManyLines },
      $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          leagueSimGame: { upsert: simUpsert },
          leagueSimOddsSnapshotRun: { create: createRun },
          leagueSimGameOddsLine: { createMany: createManyLines },
        }),
      ),
    } as unknown as PrismaClient;

    vi.mocked(computeAndPersistLeagueWeekJailed).mockResolvedValueOnce({
      ok: true,
      result: {
        jailedTeamId: "home-1",
        resolvedBy: "MONEYLINE",
        randomSeed: null,
        audit: {
          gamesInWeek: 2,
          gamesWithCompleteLines: 2,
          winningMoneylineAmerican: 1.67,
          tieLevel: "MONEYLINE",
          candidates: [],
        },
      },
      row: {
        jailedTeamId: "home-1",
        jailedTeam: { id: "home-1", abbreviation: "KC", name: "Kansas City Chiefs" },
      },
    } as never);

    const result = await applySimulationOddsSnapshot(
      prisma,
      { leagueId: LEAGUE_ID, nflSeasonYear: YEAR, weekNumber: WEEK },
      { via: "admin", userId: "admin-1" },
    );

    expect(result.ok).toBe(true);
    expect(simUpsert).toHaveBeenCalled();
    expect(nflUpsert).not.toHaveBeenCalled();
    expect(prisma.nflGame.findMany).not.toHaveBeenCalled();
    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leagueId: LEAGUE_ID,
          source: "test_fixture",
          status: "COMPLETED",
        }),
      }),
    );
    expect(vi.mocked(computeAndPersistLeagueWeekJailed)).toHaveBeenCalledWith(
      prisma,
      { leagueId: LEAGUE_ID, nflSeasonYear: YEAR, weekNumber: WEEK },
      { via: "admin", userId: "admin-1" },
    );
  });

  it("two test leagues ensure independently (leagueId in sim upsert unique key)", async () => {
    const upsertCalls: Array<{ leagueId: string }> = [];
    const simUpsert = vi.fn().mockImplementation(({ where }: { where: { leagueId_nflSeasonYear_weekNumber_homeTeamId_awayTeamId: { leagueId: string } } }) => {
      upsertCalls.push({ leagueId: where.leagueId_nflSeasonYear_weekNumber_homeTeamId_awayTeamId.leagueId });
      return Promise.resolve({});
    });

    function makePrisma(leagueId: string): PrismaClient {
      let calls = 0;
      return {
        league: {
          findUnique: vi.fn().mockResolvedValue({ isTestLeague: true }),
        },
        leagueSimGame: {
          findMany: vi.fn().mockImplementation(() => {
            calls += 1;
            return Promise.resolve(
              calls === 1
                ? []
                : [{ id: `${leagueId}-g1`, homeTeamId: "h", awayTeamId: "a" }],
            );
          }),
          upsert: simUpsert,
        },
        team: {
          findMany: vi.fn().mockResolvedValue([
            { id: "h", abbreviation: "KC" },
            { id: "a", abbreviation: "BUF" },
            { id: "h2", abbreviation: "PHI" },
            { id: "a2", abbreviation: "DAL" },
          ]),
        },
        $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            leagueSimGame: { upsert: simUpsert },
            leagueSimOddsSnapshotRun: {
              create: vi.fn().mockResolvedValue({ id: `${leagueId}-run` }),
            },
            leagueSimGameOddsLine: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
          }),
        ),
      } as unknown as PrismaClient;
    }

    vi.mocked(computeAndPersistLeagueWeekJailed).mockResolvedValue({
      ok: true,
      result: {
        jailedTeamId: "h",
        resolvedBy: "MONEYLINE",
        randomSeed: null,
        audit: {
          gamesInWeek: 1,
          gamesWithCompleteLines: 1,
          winningMoneylineAmerican: 1.67,
          tieLevel: "MONEYLINE",
          candidates: [],
        },
      },
      row: {
        jailedTeamId: "h",
        jailedTeam: { id: "h", abbreviation: "KC", name: "Kansas City Chiefs" },
      },
    } as never);

    await applySimulationOddsSnapshot(
      makePrisma("league-a"),
      { leagueId: "league-a", nflSeasonYear: YEAR, weekNumber: WEEK },
      { via: "automation" },
    );
    await applySimulationOddsSnapshot(
      makePrisma("league-b"),
      { leagueId: "league-b", nflSeasonYear: YEAR, weekNumber: WEEK },
      { via: "automation" },
    );

    expect(upsertCalls.some((c) => c.leagueId === "league-a")).toBe(true);
    expect(upsertCalls.some((c) => c.leagueId === "league-b")).toBe(true);
  });

  it("refuses non-test leagues without writing", async () => {
    const prisma = {
      league: { findUnique: vi.fn().mockResolvedValue({ isTestLeague: false }) },
      leagueSimGame: { findMany: vi.fn() },
    } as unknown as PrismaClient;

    const result = await applySimulationOddsSnapshot(
      prisma,
      { leagueId: "real-league", nflSeasonYear: YEAR, weekNumber: WEEK },
      { via: "admin", userId: "admin-1" },
    );

    expect(result).toEqual({
      ok: false,
      code: "NOT_TEST_LEAGUE",
      message: "Applying fixture odds is only available for test / rehearsal leagues",
      httpStatus: 403,
    });
    expect(prisma.leagueSimGame.findMany).not.toHaveBeenCalled();
  });
});
