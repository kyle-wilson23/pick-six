import { LeagueMembershipRole, PickOutcome } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { getLeaguePeerPickHistory } from "./get-league-peer-pick-history";

const LEAGUE_ID = "league-1";
const SEASON_ID = "season-1";
const SEASON_YEAR = 2026;

function makePick(overrides: {
  nflWeekNumber: number;
  membershipId?: string;
  displayName?: string;
  outcome?: PickOutcome | null;
  pointsEarned?: number | null;
  antiJailedBonus?: boolean;
  team?: { abbreviation: string; name: string };
}) {
  const membershipId = overrides.membershipId ?? "mem-1";
  const displayName = overrides.displayName ?? "Alice";
  return {
    nflWeekNumber: overrides.nflWeekNumber,
    antiJailedBonus: overrides.antiJailedBonus ?? false,
    outcome: overrides.outcome ?? null,
    pointsEarned: overrides.pointsEarned ?? null,
    team: overrides.team ?? { abbreviation: "KC", name: "Kansas City Chiefs" },
    leagueMembership: {
      id: membershipId,
      user: { name: displayName, email: `${membershipId}@example.com` },
    },
  };
}

function makePrisma({
  season = { id: SEASON_ID },
  games = [],
  picks = [],
}: {
  season?: { id: string } | null;
  games?: Array<{ weekNumber: number; status: string }>;
  picks?: ReturnType<typeof makePick>[];
} = {}) {
  return {
    season: {
      findUnique: vi.fn().mockResolvedValue(season),
    },
    nflGame: {
      findMany: vi.fn().mockResolvedValue(games),
    },
    pick: {
      findMany: vi.fn().mockResolvedValue(picks),
    },
  } as unknown as PrismaClient;
}

describe("getLeaguePeerPickHistory", () => {
  it("includes revealed week picks for non-admin callers", async () => {
    const prisma = makePrisma({
      games: [
        { weekNumber: 5, status: "FINAL" },
        { weekNumber: 5, status: "FINAL" },
      ],
      picks: [
        makePick({
          nflWeekNumber: 5,
          membershipId: "mem-1",
          displayName: "Alice",
          outcome: PickOutcome.WIN,
          pointsEarned: 1,
        }),
        makePick({
          nflWeekNumber: 5,
          membershipId: "mem-2",
          displayName: "Bob",
          outcome: PickOutcome.LOSS,
          pointsEarned: 0,
        }),
      ],
    });

    const result = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.MEMBER,
    });

    expect(result.weeks).toHaveLength(1);
    expect(result.weeks[0]).toMatchObject({ weekNumber: 5, isRevealed: true });
    expect(result.weeks[0].entries).toHaveLength(2);
  });

  it("excludes unrevealed week picks for non-admin callers", async () => {
    const prisma = makePrisma({
      games: [
        { weekNumber: 5, status: "FINAL" },
        { weekNumber: 5, status: "SCHEDULED" },
      ],
      picks: [
        makePick({
          nflWeekNumber: 5,
          membershipId: "mem-1",
          displayName: "Alice",
          outcome: PickOutcome.WIN,
          pointsEarned: 1,
        }),
      ],
    });

    const result = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.MEMBER,
    });

    expect(result.weeks).toHaveLength(0);
  });

  it("includes unrevealed week picks for admin callers", async () => {
    const prisma = makePrisma({
      games: [
        { weekNumber: 5, status: "FINAL" },
        { weekNumber: 5, status: "SCHEDULED" },
      ],
      picks: [
        makePick({
          nflWeekNumber: 5,
          membershipId: "mem-1",
          displayName: "Alice",
          outcome: null,
          pointsEarned: null,
        }),
      ],
    });

    const result = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.ADMIN,
    });

    expect(result.weeks).toHaveLength(1);
    expect(result.weeks[0]).toMatchObject({ weekNumber: 5, isRevealed: false });
    expect(result.weeks[0].entries).toHaveLength(1);
  });

  it("maps outcomes, pending picks, and antiJailedBonus", async () => {
    const prisma = makePrisma({
      games: [
        { weekNumber: 1, status: "FINAL" },
        { weekNumber: 2, status: "FINAL" },
        { weekNumber: 3, status: "FINAL" },
        { weekNumber: 4, status: "FINAL" },
      ],
      picks: [
        makePick({
          nflWeekNumber: 1,
          outcome: PickOutcome.WIN,
          pointsEarned: 1,
        }),
        makePick({
          nflWeekNumber: 2,
          outcome: PickOutcome.LOSS,
          pointsEarned: 0,
        }),
        makePick({
          nflWeekNumber: 3,
          outcome: PickOutcome.TIE,
          pointsEarned: 0,
        }),
        makePick({
          nflWeekNumber: 4,
          outcome: null,
          pointsEarned: null,
          antiJailedBonus: true,
        }),
      ],
    });

    const result = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.MEMBER,
    });

    const byWeek = Object.fromEntries(result.weeks.map((w) => [w.weekNumber, w.entries[0]]));
    expect(byWeek[1]).toMatchObject({ outcome: "WIN", pointsEarned: 1, antiJailedBonus: false });
    expect(byWeek[2]).toMatchObject({ outcome: "LOSS", pointsEarned: 0 });
    expect(byWeek[3]).toMatchObject({ outcome: "TIE", pointsEarned: 0 });
    expect(byWeek[4]).toMatchObject({
      outcome: "PENDING",
      pointsEarned: null,
      antiJailedBonus: true,
    });
  });

  it("returns empty weeks without querying picks when no season exists", async () => {
    const prisma = makePrisma({ season: null });

    const result = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.MEMBER,
    });

    expect(result).toEqual({ weeks: [] });
    expect(prisma.pick.findMany).not.toHaveBeenCalled();
  });

  it("sorts weeks descending by weekNumber", async () => {
    const prisma = makePrisma({
      games: [
        { weekNumber: 1, status: "FINAL" },
        { weekNumber: 2, status: "FINAL" },
        { weekNumber: 3, status: "FINAL" },
      ],
      picks: [
        makePick({ nflWeekNumber: 1, membershipId: "mem-1", displayName: "Alice" }),
        makePick({ nflWeekNumber: 2, membershipId: "mem-1", displayName: "Alice" }),
        makePick({ nflWeekNumber: 3, membershipId: "mem-1", displayName: "Alice" }),
      ],
    });

    const result = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.MEMBER,
    });

    expect(result.weeks.map((w) => w.weekNumber)).toEqual([3, 2, 1]);
  });

  it("sorts entries ascending by displayName within a week", async () => {
    const prisma = makePrisma({
      games: [{ weekNumber: 1, status: "FINAL" }],
      picks: [
        makePick({ nflWeekNumber: 1, membershipId: "mem-3", displayName: "Charlie" }),
        makePick({ nflWeekNumber: 1, membershipId: "mem-1", displayName: "Alice" }),
        makePick({ nflWeekNumber: 1, membershipId: "mem-2", displayName: "Bob" }),
      ],
    });

    const result = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.MEMBER,
    });

    expect(result.weeks[0].entries.map((e) => e.displayName)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("treats mixed FINAL and SCHEDULED games in a week as not revealed", async () => {
    const prisma = makePrisma({
      games: [
        { weekNumber: 5, status: "FINAL" },
        { weekNumber: 5, status: "SCHEDULED" },
      ],
      picks: [
        makePick({
          nflWeekNumber: 5,
          membershipId: "mem-1",
          displayName: "Alice",
          outcome: PickOutcome.WIN,
          pointsEarned: 1,
        }),
      ],
    });

    const memberResult = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.MEMBER,
    });
    expect(memberResult.weeks).toHaveLength(0);

    const adminResult = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.ADMIN,
    });
    expect(adminResult.weeks).toHaveLength(1);
    expect(adminResult.weeks[0].isRevealed).toBe(false);
  });
});
