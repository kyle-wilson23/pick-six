import { PickOutcome } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { getPersonalPickHistory } from "./get-personal-pick-history";

const LEAGUE_ID = "league-1";
const SEASON_ID = "season-1";
const SEASON_YEAR = 2026;
const MEMBERSHIP_ID = "mem-1";

function makePick(overrides: {
  nflWeekNumber: number;
  outcome?: PickOutcome | null;
  pointsEarned?: number | null;
  antiJailedBonus?: boolean;
  team?: { abbreviation: string; name: string };
}) {
  return {
    nflWeekNumber: overrides.nflWeekNumber,
    antiJailedBonus: overrides.antiJailedBonus ?? false,
    outcome: overrides.outcome ?? null,
    pointsEarned: overrides.pointsEarned ?? null,
    team: overrides.team ?? { abbreviation: "KC", name: "Kansas City Chiefs" },
  };
}

function makePrisma({
  season = { id: SEASON_ID },
  picks = [],
}: {
  season?: { id: string } | null;
  picks?: ReturnType<typeof makePick>[];
} = {}) {
  return {
    season: {
      findFirst: vi.fn().mockResolvedValue(season),
    },
    pick: {
      // Return picks as-is; ordering is the DB's responsibility (verified via orderBy assertion)
      findMany: vi.fn().mockResolvedValue(picks),
    },
  } as unknown as PrismaClient;
}

describe("getPersonalPickHistory", () => {
  it("queries with orderBy nflWeekNumber ascending and maps team data correctly", async () => {
    const prisma = makePrisma({
      picks: [
        makePick({
          nflWeekNumber: 1,
          outcome: PickOutcome.LOSS,
          pointsEarned: 0,
          team: { abbreviation: "KC", name: "Kansas City Chiefs" },
        }),
        makePick({
          nflWeekNumber: 2,
          outcome: PickOutcome.WIN,
          pointsEarned: 2,
          antiJailedBonus: true,
          team: { abbreviation: "SF", name: "San Francisco 49ers" },
        }),
        makePick({
          nflWeekNumber: 3,
          outcome: PickOutcome.WIN,
          pointsEarned: 1,
          team: { abbreviation: "BUF", name: "Buffalo Bills" },
        }),
      ],
    });

    const result = await getPersonalPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      membershipId: MEMBERSHIP_ID,
    });

    // Verify the query requests ascending sort — DB is responsible for the actual ordering
    expect(prisma.pick.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { leagueMembershipId: MEMBERSHIP_ID, seasonId: SEASON_ID },
        orderBy: { nflWeekNumber: "asc" },
      }),
    );
    expect(result.entries[0]).toMatchObject({
      teamAbbreviation: "KC",
      teamName: "Kansas City Chiefs",
      outcome: "LOSS",
      pointsEarned: 0,
    });
    expect(result.entries[1]).toMatchObject({
      teamAbbreviation: "SF",
      antiJailedBonus: true,
      outcome: "WIN",
      pointsEarned: 2,
    });
  });

  it("maps outcomes and pointsEarned including anti-jailed bonus", async () => {
    const result = await getPersonalPickHistory(
      makePrisma({
        picks: [
          makePick({ nflWeekNumber: 1, outcome: PickOutcome.WIN, pointsEarned: 1 }),
          makePick({
            nflWeekNumber: 2,
            outcome: PickOutcome.WIN,
            pointsEarned: 2,
            antiJailedBonus: true,
          }),
          makePick({ nflWeekNumber: 3, outcome: PickOutcome.LOSS, pointsEarned: 0 }),
          makePick({ nflWeekNumber: 4, outcome: PickOutcome.TIE, pointsEarned: 0 }),
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR, membershipId: MEMBERSHIP_ID },
    );

    expect(result.entries[0]).toMatchObject({ outcome: "WIN", pointsEarned: 1, antiJailedBonus: false });
    expect(result.entries[1]).toMatchObject({ outcome: "WIN", pointsEarned: 2, antiJailedBonus: true });
    expect(result.entries[2]).toMatchObject({ outcome: "LOSS", pointsEarned: 0 });
    expect(result.entries[3]).toMatchObject({ outcome: "TIE", pointsEarned: 0 });
  });

  it("maps pending picks with null points and excludes them from summary", async () => {
    const result = await getPersonalPickHistory(
      makePrisma({
        picks: [
          makePick({ nflWeekNumber: 1, outcome: PickOutcome.WIN, pointsEarned: 1 }),
          makePick({
            nflWeekNumber: 2,
            outcome: null,
            pointsEarned: null,
          }),
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR, membershipId: MEMBERSHIP_ID },
    );

    expect(result.entries[1]).toMatchObject({ outcome: "PENDING", pointsEarned: null });
    expect(result.totalPoints).toBe(1);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
    expect(result.ties).toBe(0);
  });

  it("aggregates summary over scored picks only in a mixed set", async () => {
    const result = await getPersonalPickHistory(
      makePrisma({
        picks: [
          makePick({ nflWeekNumber: 1, outcome: PickOutcome.WIN, pointsEarned: 1 }),
          makePick({
            nflWeekNumber: 2,
            outcome: PickOutcome.WIN,
            pointsEarned: 2,
            antiJailedBonus: true,
          }),
          makePick({ nflWeekNumber: 3, outcome: PickOutcome.LOSS, pointsEarned: 0 }),
          makePick({ nflWeekNumber: 4, outcome: PickOutcome.TIE, pointsEarned: 0 }),
          makePick({ nflWeekNumber: 5, outcome: null, pointsEarned: null }),
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR, membershipId: MEMBERSHIP_ID },
    );

    expect(result.totalPoints).toBe(3);
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.ties).toBe(1);
  });

  it("returns empty result without querying picks when no season exists", async () => {
    const prisma = makePrisma({ season: null });

    const result = await getPersonalPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      membershipId: MEMBERSHIP_ID,
    });

    expect(result).toEqual({
      entries: [],
      totalPoints: 0,
      wins: 0,
      losses: 0,
      ties: 0,
    });
    expect(prisma.pick.findMany).not.toHaveBeenCalled();
  });

  it("coerces null pointsEarned to 0 for a scored pick and includes it in totals", async () => {
    const result = await getPersonalPickHistory(
      makePrisma({
        picks: [
          makePick({ nflWeekNumber: 1, outcome: PickOutcome.WIN, pointsEarned: null }),
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR, membershipId: MEMBERSHIP_ID },
    );

    expect(result.entries[0]).toMatchObject({ outcome: "WIN", pointsEarned: 0 });
    expect(result.totalPoints).toBe(0);
    expect(result.wins).toBe(1);
  });

  it("returns empty entries and zero summary when season exists but member has no picks", async () => {
    const result = await getPersonalPickHistory(makePrisma({ picks: [] }), {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      membershipId: MEMBERSHIP_ID,
    });

    expect(result).toEqual({
      entries: [],
      totalPoints: 0,
      wins: 0,
      losses: 0,
      ties: 0,
    });
  });
});
