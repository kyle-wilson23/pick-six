import { LeagueMembershipRole, PickOutcome } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { computePickDeadlineUtc } from "@/lib/domain/pick-deadline";

import { getLeaguePeerPickHistory } from "./get-league-peer-pick-history";

const LEAGUE_ID = "league-1";
const SEASON_ID = "season-1";
const SEASON_YEAR = 2026;

function makePick(overrides: {
  nflWeekNumber: number;
  membershipId?: string;
  displayName?: string;
  imageUrl?: string | null;
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
      user: {
        name: displayName,
        email: `${membershipId}@example.com`,
        image: overrides.imageUrl ?? null,
      },
    },
  };
}

function makePrisma({
  season = { id: SEASON_ID },
  games = [],
  picks = [],
}: {
  season?: { id: string } | null;
  games?: Array<{ weekNumber: number; status: string; kickoffAt?: Date }>;
  picks?: ReturnType<typeof makePick>[];
} = {}) {
  return {
    season: {
      findUnique: vi.fn().mockResolvedValue(season),
    },
    league: {
      findUnique: vi.fn().mockResolvedValue({ isTestLeague: false }),
    },
    nflGame: {
      findMany: vi.fn().mockResolvedValue(
        games.map((g) => ({
          id: `g-${g.weekNumber}`,
          nflSeasonYear: SEASON_YEAR,
          weekNumber: g.weekNumber,
          homeTeamId: "h",
          awayTeamId: "a",
          kickoffAt: g.kickoffAt ?? new Date("2026-09-14T17:00:00.000Z"),
          status: g.status,
          homeScore: null,
          awayScore: null,
          finalizedAt: null,
        })),
      ),
    },
    leagueSimGame: {
      findMany: vi.fn().mockResolvedValue([]),
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
          imageUrl: "https://example.com/alice.jpg",
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
    expect(result.weeks[0].entries.map((e) => e.imageUrl)).toEqual([
      "https://example.com/alice.jpg",
      null,
    ]);
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

  it("redacts other members' team identity for admin callers while the window is open", async () => {
    const kickoff = new Date("2026-09-14T17:00:00.000Z");
    const now = new Date(computePickDeadlineUtc(kickoff).getTime() - 1);
    const prisma = makePrisma({
      games: [{ weekNumber: 5, status: "SCHEDULED", kickoffAt: kickoff }],
      picks: [
        makePick({
          nflWeekNumber: 5,
          membershipId: "mem-admin",
          displayName: "Admin",
          team: { abbreviation: "KC", name: "Kansas City Chiefs" },
        }),
        makePick({
          nflWeekNumber: 5,
          membershipId: "mem-peer",
          displayName: "Peer",
          team: { abbreviation: "BUF", name: "Buffalo Bills" },
          antiJailedBonus: true,
          outcome: PickOutcome.WIN,
          pointsEarned: 2,
        }),
      ],
    });

    const result = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.ADMIN,
      callerMembershipId: "mem-admin",
      now,
    });

    expect(result.weeks).toHaveLength(1);
    const byId = Object.fromEntries(result.weeks[0].entries.map((e) => [e.membershipId, e]));
    expect(byId["mem-admin"]).toMatchObject({
      teamAbbreviation: "KC",
      teamName: "Kansas City Chiefs",
    });
    expect(byId["mem-peer"]).toMatchObject({
      teamAbbreviation: null,
      teamName: null,
      antiJailedBonus: false,
      outcome: "PENDING",
      pointsEarned: null,
    });
  });

  it("reveals admin peer teams after the deadline even when the week is not finalized", async () => {
    const kickoff = new Date("2026-09-14T17:00:00.000Z");
    const now = new Date(computePickDeadlineUtc(kickoff).getTime() + 1);
    const prisma = makePrisma({
      games: [{ weekNumber: 5, status: "SCHEDULED", kickoffAt: kickoff }],
      picks: [
        makePick({
          nflWeekNumber: 5,
          membershipId: "mem-peer",
          displayName: "Peer",
          team: { abbreviation: "BUF", name: "Buffalo Bills" },
          antiJailedBonus: true,
        }),
      ],
    });

    const result = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.ADMIN,
      callerMembershipId: "mem-admin",
      now,
    });

    expect(result.weeks[0]?.entries[0]).toMatchObject({
      teamAbbreviation: "BUF",
      teamName: "Buffalo Bills",
      antiJailedBonus: true,
    });
  });

  it("does not include unfinalized weeks for non-admin callers even after the deadline", async () => {
    const kickoff = new Date("2026-09-14T17:00:00.000Z");
    const now = new Date(computePickDeadlineUtc(kickoff).getTime() + 1);
    const prisma = makePrisma({
      games: [{ weekNumber: 5, status: "SCHEDULED", kickoffAt: kickoff }],
      picks: [
        makePick({
          nflWeekNumber: 5,
          membershipId: "mem-1",
          displayName: "Alice",
        }),
      ],
    });

    const result = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.MEMBER,
      callerMembershipId: "mem-1",
      now,
    });

    expect(result.weeks).toHaveLength(0);
  });
});
