import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { getJailedTeamIdForLeagueWeek } from "@/lib/nfl/league-jailed";
import { resolveGamesForLeague } from "@/lib/nfl/resolve-games-for-league";

const YEAR = 2026;
const WEEK = 4;

/**
 * Isolation matrix for hybrid Option B (spec acceptance criteria).
 */
describe("hybrid schedule isolation", () => {
  it("real-after-test: real league week view is canonical only (no sim fixture rows)", async () => {
    const prisma = {
      league: { findUnique: vi.fn().mockResolvedValue({ isTestLeague: false }) },
      nflGame: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "live-1",
            nflSeasonYear: YEAR,
            weekNumber: WEEK,
            homeTeamId: "h",
            awayTeamId: "a",
            kickoffAt: new Date("2026-09-28T17:00:00.000Z"),
            status: "SCHEDULED",
            homeScore: null,
            awayScore: null,
            finalizedAt: null,
          },
        ]),
      },
      leagueSimGame: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "fixture-should-not-appear",
            nflSeasonYear: YEAR,
            weekNumber: WEEK,
            homeTeamId: "fh",
            awayTeamId: "fa",
            kickoffAt: new Date("2026-09-28T17:00:00.000Z"),
            status: "SCHEDULED",
            homeScore: null,
            awayScore: null,
            finalizedAt: null,
          },
        ]),
      },
    } as unknown as PrismaClient;

    const games = await resolveGamesForLeague(prisma, {
      leagueId: "real-league",
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(games.map((g) => g.id)).toEqual(["live-1"]);
    expect(games.every((g) => g.source === "canonical")).toBe(true);
    expect(prisma.leagueSimGame.findMany).not.toHaveBeenCalled();
  });

  it("fails closed when league is missing (does not default to real/canonical)", async () => {
    const prisma = {
      league: { findUnique: vi.fn().mockResolvedValue(null) },
      nflGame: { findMany: vi.fn() },
      leagueSimGame: { findMany: vi.fn() },
    } as unknown as PrismaClient;

    await expect(
      resolveGamesForLeague(prisma, {
        leagueId: "gone",
        nflSeasonYear: YEAR,
        weekNumber: WEEK,
      }),
    ).rejects.toThrow(/League not found: gone/);
    expect(prisma.nflGame.findMany).not.toHaveBeenCalled();
    expect(prisma.leagueSimGame.findMany).not.toHaveBeenCalled();
  });

  it("two test leagues: each reads only its own sim rows (distinct leagueId)", async () => {
    const findManyA = vi.fn().mockResolvedValue([
      {
        id: "a-sim-1",
        nflSeasonYear: YEAR,
        weekNumber: WEEK,
        homeTeamId: "h",
        awayTeamId: "a",
        kickoffAt: new Date("2026-09-28T17:00:00.000Z"),
        status: "SCHEDULED",
        homeScore: null,
        awayScore: null,
        finalizedAt: null,
      },
    ]);
    const findManyB = vi.fn().mockResolvedValue([
      {
        id: "b-sim-1",
        nflSeasonYear: YEAR,
        weekNumber: WEEK,
        homeTeamId: "h2",
        awayTeamId: "a2",
        kickoffAt: new Date("2026-09-28T17:00:00.000Z"),
        status: "SCHEDULED",
        homeScore: null,
        awayScore: null,
        finalizedAt: null,
      },
    ]);

    const prismaA = {
      league: { findUnique: vi.fn() },
      leagueSimGame: { findMany: findManyA },
      nflGame: { findMany: vi.fn() },
    } as unknown as PrismaClient;
    const prismaB = {
      league: { findUnique: vi.fn() },
      leagueSimGame: { findMany: findManyB },
      nflGame: { findMany: vi.fn() },
    } as unknown as PrismaClient;

    const a = await resolveGamesForLeague(prismaA, {
      leagueId: "league-a",
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
      isTestLeague: true,
    });
    const b = await resolveGamesForLeague(prismaB, {
      leagueId: "league-b",
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
      isTestLeague: true,
    });

    expect(a.map((g) => g.id)).toEqual(["a-sim-1"]);
    expect(b.map((g) => g.id)).toEqual(["b-sim-1"]);
    expect(findManyA).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ leagueId: "league-a" }),
      }),
    );
    expect(findManyB).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ leagueId: "league-b" }),
      }),
    );
    expect(findManyA.mock.calls[0]![0].where.leagueId).not.toBe(
      findManyB.mock.calls[0]![0].where.leagueId,
    );
  });

  it("Odds sync surface stays on nflGame — resolveGamesForLeague sim path unused for real leagues", async () => {
    // sync-nfl-schedule-from-odds only touches prisma.nflGame (canonical). This asserts the
    // real-league facade never consults LeagueSimGame, so orphan-delete cannot see sim rows.
    const prisma = {
      league: { findUnique: vi.fn().mockResolvedValue({ isTestLeague: false }) },
      nflGame: { findMany: vi.fn().mockResolvedValue([]) },
      leagueSimGame: { findMany: vi.fn() },
    } as unknown as PrismaClient;

    await resolveGamesForLeague(prisma, {
      leagueId: "real",
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(prisma.nflGame.findMany).toHaveBeenCalled();
    expect(prisma.leagueSimGame.findMany).not.toHaveBeenCalled();
  });

  it("schedule sync module only deletes nflGame orphans — never leagueSimGame", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/nfl/sync-nfl-schedule-from-odds.ts"),
      "utf8",
    );
    expect(src).toContain("nflGame.deleteMany");
    expect(src).not.toMatch(/leagueSimGame\.delete/i);
    expect(src).toMatch(/LeagueSimGame.*never|never.*LeagueSimGame/i);
  });

  it("test jailed does not overwrite global: real league reads NflWeekJailedTeam only", async () => {
    const prisma = {
      nflWeekJailedTeam: {
        findUnique: vi.fn().mockResolvedValue({ jailedTeamId: "global-jailed" }),
      },
      leagueWeekJailedTeam: {
        findUnique: vi.fn().mockResolvedValue({ jailedTeamId: "sim-jailed" }),
      },
    } as unknown as PrismaClient;

    const id = await getJailedTeamIdForLeagueWeek(prisma, {
      leagueId: "real-league",
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
      isTestLeague: false,
    });

    expect(id).toBe("global-jailed");
    expect(prisma.nflWeekJailedTeam.findUnique).toHaveBeenCalled();
    expect(prisma.leagueWeekJailedTeam.findUnique).not.toHaveBeenCalled();
  });

  it("test league jailed reads LeagueWeekJailedTeam only", async () => {
    const prisma = {
      nflWeekJailedTeam: {
        findUnique: vi.fn().mockResolvedValue({ jailedTeamId: "global-jailed" }),
      },
      leagueWeekJailedTeam: {
        findUnique: vi.fn().mockResolvedValue({ jailedTeamId: "sim-jailed" }),
      },
    } as unknown as PrismaClient;

    const id = await getJailedTeamIdForLeagueWeek(prisma, {
      leagueId: "test-league",
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
      isTestLeague: true,
    });

    expect(id).toBe("sim-jailed");
    expect(prisma.leagueWeekJailedTeam.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          leagueId_nflSeasonYear_weekNumber: {
            leagueId: "test-league",
            nflSeasonYear: YEAR,
            weekNumber: WEEK,
          },
        },
      }),
    );
    expect(prisma.nflWeekJailedTeam.findUnique).not.toHaveBeenCalled();
  });
});
