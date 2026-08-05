import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import {
  resolveGamesForLeague,
  resolveGamesForLeagueWithTeams,
} from "@/lib/nfl/resolve-games-for-league";

const YEAR = 2026;
const WEEK = 3;

function baseGame(id: string, overrides: Partial<{
  homeTeamId: string;
  awayTeamId: string;
  weekNumber: number;
}> = {}) {
  return {
    id,
    nflSeasonYear: YEAR,
    weekNumber: overrides.weekNumber ?? WEEK,
    homeTeamId: overrides.homeTeamId ?? "home-1",
    awayTeamId: overrides.awayTeamId ?? "away-1",
    kickoffAt: new Date("2026-09-14T17:00:00.000Z"),
    status: "SCHEDULED" as const,
    homeScore: null,
    awayScore: null,
    finalizedAt: null,
  };
}

describe("resolveGamesForLeague", () => {
  it("returns canonical NflGame rows for real leagues (excludes fixture-only)", async () => {
    const canonical = [baseGame("nfl-1"), baseGame("nfl-2", { homeTeamId: "h2", awayTeamId: "a2" })];
    const prisma = {
      league: { findUnique: vi.fn().mockResolvedValue({ isTestLeague: false }) },
      nflGame: { findMany: vi.fn().mockResolvedValue(canonical) },
      leagueSimGame: { findMany: vi.fn() },
    } as unknown as PrismaClient;

    const out = await resolveGamesForLeague(prisma, {
      leagueId: "real-league",
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(out).toHaveLength(2);
    expect(out.every((g) => g.source === "canonical")).toBe(true);
    expect(prisma.nflGame.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          nflSeasonYear: YEAR,
          weekNumber: WEEK,
          NOT: expect.objectContaining({
            oddsLines: expect.objectContaining({
              some: expect.anything(),
              none: expect.anything(),
            }),
          }),
        }),
      }),
    );
    expect(prisma.leagueSimGame.findMany).not.toHaveBeenCalled();
  });

  it("returns LeagueSimGame rows for test leagues and never reads NflGame", async () => {
    const sim = [baseGame("sim-1")];
    const prisma = {
      league: { findUnique: vi.fn().mockResolvedValue({ isTestLeague: true }) },
      nflGame: { findMany: vi.fn() },
      leagueSimGame: { findMany: vi.fn().mockResolvedValue(sim) },
    } as unknown as PrismaClient;

    const out = await resolveGamesForLeague(prisma, {
      leagueId: "test-league",
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(out).toEqual([{ ...sim[0], source: "sim" }]);
    expect(prisma.leagueSimGame.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { leagueId: "test-league", nflSeasonYear: YEAR, weekNumber: WEEK },
      }),
    );
    expect(prisma.nflGame.findMany).not.toHaveBeenCalled();
  });

  it("skips league lookup when isTestLeague is provided", async () => {
    const prisma = {
      league: { findUnique: vi.fn() },
      nflGame: { findMany: vi.fn().mockResolvedValue([]) },
      leagueSimGame: { findMany: vi.fn() },
    } as unknown as PrismaClient;

    await resolveGamesForLeague(prisma, {
      leagueId: "real-league",
      nflSeasonYear: YEAR,
      isTestLeague: false,
    });

    expect(prisma.league.findUnique).not.toHaveBeenCalled();
    expect(prisma.nflGame.findMany).toHaveBeenCalled();
  });

  it("fails closed when league row is missing", async () => {
    const prisma = {
      league: { findUnique: vi.fn().mockResolvedValue(null) },
      nflGame: { findMany: vi.fn() },
      leagueSimGame: { findMany: vi.fn() },
    } as unknown as PrismaClient;

    await expect(
      resolveGamesForLeague(prisma, {
        leagueId: "missing-league",
        nflSeasonYear: YEAR,
        weekNumber: WEEK,
      }),
    ).rejects.toThrow(/League not found: missing-league/);
    expect(prisma.nflGame.findMany).not.toHaveBeenCalled();
    expect(prisma.leagueSimGame.findMany).not.toHaveBeenCalled();
  });

  it("real-after-test isolation: real league does not see another league’s sim rows", async () => {
    const prisma = {
      league: { findUnique: vi.fn().mockResolvedValue({ isTestLeague: false }) },
      nflGame: { findMany: vi.fn().mockResolvedValue([]) },
      leagueSimGame: {
        findMany: vi.fn().mockResolvedValue([baseGame("should-not-appear")]),
      },
    } as unknown as PrismaClient;

    const out = await resolveGamesForLeague(prisma, {
      leagueId: "real-after-test",
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(out).toEqual([]);
    expect(prisma.leagueSimGame.findMany).not.toHaveBeenCalled();
  });
});

describe("resolveGamesForLeagueWithTeams", () => {
  it("includes team labels for test league sim games", async () => {
    const team = { id: "t1", abbreviation: "KC", name: "Kansas City Chiefs" };
    const away = { id: "t2", abbreviation: "BUF", name: "Buffalo Bills" };
    const prisma = {
      league: { findUnique: vi.fn() },
      leagueSimGame: {
        findMany: vi.fn().mockResolvedValue([
          {
            ...baseGame("sim-1", { homeTeamId: team.id, awayTeamId: away.id }),
            homeTeam: team,
            awayTeam: away,
          },
        ]),
      },
      nflGame: { findMany: vi.fn() },
    } as unknown as PrismaClient;

    const out = await resolveGamesForLeagueWithTeams(prisma, {
      leagueId: "test-league",
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
      isTestLeague: true,
    });

    expect(out[0]).toMatchObject({
      id: "sim-1",
      source: "sim",
      homeTeam: team,
      awayTeam: away,
    });
  });
});
