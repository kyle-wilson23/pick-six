import { LeagueMembershipRole, PickOutcome } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { computePickDeadlineUtc } from "@/lib/domain/pick-deadline";
import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";

import { getLeaguePeerPickHistory } from "./get-league-peer-pick-history";

const LEAGUE_ID = "league-1";
const SEASON_ID = "season-1";
const SEASON_YEAR = 2026;

function makePick(overrides: {
  nflWeekNumber: number;
  membershipId?: string;
  displayName?: string;
  email?: string;
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
        email: overrides.email ?? `${membershipId}@example.com`,
        image: overrides.imageUrl ?? null,
      },
    },
  };
}

function makeMembership(overrides: {
  id: string;
  displayName: string;
  email?: string;
  imageUrl?: string | null;
}) {
  return {
    id: overrides.id,
    user: {
      name: overrides.displayName,
      email: overrides.email ?? `${overrides.id}@example.com`,
      image: overrides.imageUrl ?? null,
    },
  };
}

function makePrisma({
  season,
  isTestLeague = false,
  games = [],
  picks = [],
  memberships,
}: {
  season?: {
    id: string;
    firstCompetitionWeek?: number;
    simulatedCurrentWeek?: number | null;
  } | null;
  isTestLeague?: boolean;
  games?: Array<{ weekNumber: number; status: string; kickoffAt?: Date }>;
  picks?: ReturnType<typeof makePick>[];
  memberships?: ReturnType<typeof makeMembership>[];
} = {}) {
  const resolvedSeason =
    season === null
      ? null
      : {
          id: SEASON_ID,
          firstCompetitionWeek: 1,
          ...season,
        };
  const mappedGames = games.map((g) => ({
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
  }));
  const resolvedMemberships =
    memberships ??
    [...new Map(picks.map((pick) => [pick.leagueMembership.id, pick.leagueMembership])).values()];
  return {
    season: {
      findUnique: vi.fn().mockResolvedValue(resolvedSeason),
    },
    league: {
      findUnique: vi.fn().mockResolvedValue({ isTestLeague }),
    },
    nflGame: {
      findMany: vi.fn().mockResolvedValue(isTestLeague ? [] : mappedGames),
    },
    leagueSimGame: {
      findMany: vi.fn().mockResolvedValue(isTestLeague ? mappedGames : []),
    },
    pick: {
      findMany: vi.fn().mockResolvedValue(picks),
    },
    leagueMembership: {
      findMany: vi.fn().mockResolvedValue(resolvedMemberships),
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
    expect(result.weeks[0].entries.map((e) => e.hasPick)).toEqual([true, true]);
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
    expect(result.weeks[0].entries[0]).toMatchObject({ hasPick: true });
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
    expect(byWeek[1]).toMatchObject({
      hasPick: true,
      outcome: "WIN",
      pointsEarned: 1,
      antiJailedBonus: false,
    });
    expect(byWeek[2]).toMatchObject({ hasPick: true, outcome: "LOSS", pointsEarned: 0 });
    expect(byWeek[3]).toMatchObject({ hasPick: true, outcome: "TIE", pointsEarned: 0 });
    expect(byWeek[4]).toMatchObject({
      hasPick: true,
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
      hasPick: true,
      teamAbbreviation: "KC",
      teamName: "Kansas City Chiefs",
    });
    expect(byId["mem-peer"]).toMatchObject({
      hasPick: true,
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
      hasPick: true,
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

  it("reveals prior test-league weeks to admins after sim advance even when kickoffs are still in the future", async () => {
    const futureKickoff = new Date("2026-09-11T20:00:00.000Z");
    const now = new Date("2026-08-26T16:00:00.000Z");
    const prisma = makePrisma({
      isTestLeague: true,
      season: { id: SEASON_ID, simulatedCurrentWeek: 2 },
      games: [
        { weekNumber: 1, status: "FINAL", kickoffAt: futureKickoff },
        { weekNumber: 2, status: "SCHEDULED", kickoffAt: new Date("2026-09-18T20:00:00.000Z") },
      ],
      picks: [
        makePick({
          nflWeekNumber: 1,
          membershipId: "mem-peer",
          displayName: "Peer",
          team: { abbreviation: "BUF", name: "Buffalo Bills" },
          outcome: PickOutcome.WIN,
          pointsEarned: 1,
        }),
        makePick({
          nflWeekNumber: 2,
          membershipId: "mem-peer",
          displayName: "Peer",
          team: { abbreviation: "KC", name: "Kansas City Chiefs" },
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

    const byWeek = Object.fromEntries(result.weeks.map((w) => [w.weekNumber, w]));
    expect(byWeek[1]?.entries[0]).toMatchObject({
      hasPick: true,
      teamAbbreviation: "BUF",
      teamName: "Buffalo Bills",
      outcome: "WIN",
      pointsEarned: 1,
    });
    expect(byWeek[2]?.entries[0]).toMatchObject({
      hasPick: true,
      teamAbbreviation: null,
      teamName: null,
      outcome: "PENDING",
    });
  });

  it("lists a missed player with zero points on a revealed week and keeps the saved pick", async () => {
    const prisma = makePrisma({
      games: [
        { weekNumber: 5, status: "FINAL" },
        { weekNumber: 5, status: "FINAL" },
      ],
      memberships: [
        makeMembership({ id: "mem-1", displayName: "Alice" }),
        makeMembership({ id: "mem-2", displayName: "Bob" }),
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

    expect(result.weeks).toHaveLength(1);
    expect(result.weeks[0]).toMatchObject({ weekNumber: 5, isRevealed: true });
    expect(result.weeks[0].entries).toHaveLength(2);
    const byId = Object.fromEntries(result.weeks[0].entries.map((e) => [e.membershipId, e]));
    expect(byId["mem-1"]).toMatchObject({
      hasPick: true,
      teamAbbreviation: "KC",
      teamName: "Kansas City Chiefs",
      outcome: "WIN",
      pointsEarned: 1,
    });
    expect(byId["mem-2"]).toMatchObject({
      hasPick: false,
      teamAbbreviation: null,
      teamName: null,
      antiJailedBonus: false,
      outcome: "PENDING",
      pointsEarned: 0,
    });
    expect(result.weeks[0].entries.filter((e) => e.membershipId === "mem-1")).toHaveLength(1);
  });

  it("redacts a saved pick and lists a no-pick peer while the window is open", async () => {
    const kickoff = new Date("2026-09-14T17:00:00.000Z");
    const now = new Date(computePickDeadlineUtc(kickoff).getTime() - 1);
    const prisma = makePrisma({
      games: [{ weekNumber: 5, status: "SCHEDULED", kickoffAt: kickoff }],
      memberships: [
        makeMembership({ id: "mem-admin", displayName: "Admin" }),
        makeMembership({ id: "mem-peer", displayName: "Peer" }),
        makeMembership({ id: "mem-miss", displayName: "Miss" }),
      ],
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
    expect(result.weeks[0].isRevealed).toBe(false);
    const byId = Object.fromEntries(result.weeks[0].entries.map((e) => [e.membershipId, e]));
    expect(byId["mem-peer"]).toMatchObject({
      hasPick: true,
      teamAbbreviation: null,
      teamName: null,
      antiJailedBonus: false,
      outcome: "PENDING",
      pointsEarned: null,
    });
    expect(byId["mem-miss"]).toMatchObject({
      hasPick: false,
      teamAbbreviation: null,
      teamName: null,
      antiJailedBonus: false,
      outcome: "PENDING",
      pointsEarned: null,
    });
    expect(byId["mem-miss"].teamName).not.toBe("No pick");
  });

  it("omits an open week for members even when the roster includes someone with no pick", async () => {
    const prisma = makePrisma({
      games: [
        { weekNumber: 5, status: "FINAL" },
        { weekNumber: 5, status: "SCHEDULED" },
      ],
      memberships: [
        makeMembership({ id: "mem-1", displayName: "Alice" }),
        makeMembership({ id: "mem-2", displayName: "Bob" }),
      ],
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
    });

    expect(result.weeks).toHaveLength(0);
  });

  it("lists every player as no-pick on a finalized week with zero picks", async () => {
    const prisma = makePrisma({
      games: [{ weekNumber: 3, status: "FINAL" }],
      memberships: [
        makeMembership({ id: "mem-2", displayName: "Bob" }),
        makeMembership({ id: "mem-1", displayName: "Alice" }),
      ],
      picks: [],
    });

    const result = await getLeaguePeerPickHistory(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      callerRole: LeagueMembershipRole.MEMBER,
    });

    expect(result.weeks).toHaveLength(1);
    expect(result.weeks[0]).toMatchObject({ weekNumber: 3, isRevealed: true });
    expect(result.weeks[0].entries.map((e) => e.displayName)).toEqual(["Alice", "Bob"]);
    expect(result.weeks[0].entries).toEqual([
      expect.objectContaining({
        membershipId: "mem-1",
        hasPick: false,
        teamAbbreviation: null,
        teamName: null,
        outcome: "PENDING",
        pointsEarned: 0,
      }),
      expect.objectContaining({
        membershipId: "mem-2",
        hasPick: false,
        teamAbbreviation: null,
        teamName: null,
        outcome: "PENDING",
        pointsEarned: 0,
      }),
    ]);
  });

  it("omits weeks before firstCompetitionWeek", async () => {
    const prisma = makePrisma({
      season: { id: SEASON_ID, firstCompetitionWeek: 4 },
      games: [
        { weekNumber: 3, status: "FINAL" },
        { weekNumber: 4, status: "FINAL" },
      ],
      memberships: [makeMembership({ id: "mem-1", displayName: "Alice" })],
      picks: [
        makePick({
          nflWeekNumber: 3,
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

    expect(result.weeks.map((w) => w.weekNumber)).toEqual([4]);
    expect(result.weeks[0].entries[0]).toMatchObject({
      membershipId: "mem-1",
      hasPick: false,
      teamAbbreviation: null,
      teamName: null,
      outcome: "PENDING",
      pointsEarned: 0,
    });
  });

  it("excludes the configured superuser", async () => {
    const previous = process.env.SUPERUSER_EMAIL;
    process.env.SUPERUSER_EMAIL = "root@example.com";
    try {
      const prisma = makePrisma({
        games: [{ weekNumber: 5, status: "FINAL" }],
        memberships: [
          makeMembership({ id: "mem-1", displayName: "Alice" }),
          makeMembership({
            id: "mem-root",
            displayName: "Root",
            email: "root@example.com",
          }),
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
            membershipId: "mem-root",
            displayName: "Root",
            email: "root@example.com",
            outcome: PickOutcome.WIN,
            pointsEarned: 1,
          }),
        ],
      });

      const result = await getLeaguePeerPickHistory(prisma, {
        leagueId: LEAGUE_ID,
        nflSeasonYear: SEASON_YEAR,
        callerRole: LeagueMembershipRole.ADMIN,
      });

      expect(prisma.leagueMembership.findMany).toHaveBeenCalledWith({
        where: leaguePlayerMembershipWhere(LEAGUE_ID),
        select: {
          id: true,
          user: { select: { name: true, email: true, image: true } },
        },
      });
      expect(result.weeks).toHaveLength(1);
      expect(result.weeks[0].entries.map((e) => e.membershipId)).toEqual(["mem-1"]);
      expect(result.weeks[0].entries[0]).toMatchObject({ hasPick: true, displayName: "Alice" });
    } finally {
      if (previous === undefined) delete process.env.SUPERUSER_EMAIL;
      else process.env.SUPERUSER_EMAIL = previous;
    }
  });

  it("sorts pickers and non-pickers together A-Z by display name", async () => {
    const prisma = makePrisma({
      games: [{ weekNumber: 2, status: "FINAL" }],
      memberships: [
        makeMembership({ id: "mem-cara", displayName: "Cara" }),
        makeMembership({ id: "mem-alice", displayName: "Alice" }),
        makeMembership({ id: "mem-bob", displayName: "Bob" }),
      ],
      picks: [
        makePick({
          nflWeekNumber: 2,
          membershipId: "mem-cara",
          displayName: "Cara",
          outcome: PickOutcome.LOSS,
          pointsEarned: 0,
        }),
        makePick({
          nflWeekNumber: 2,
          membershipId: "mem-alice",
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

    expect(result.weeks[0].entries.map((e) => [e.displayName, e.hasPick])).toEqual([
      ["Alice", true],
      ["Bob", false],
      ["Cara", true],
    ]);
    expect(result.weeks[0].entries.filter((e) => e.membershipId === "mem-alice")).toHaveLength(1);
    expect(result.weeks[0].entries.filter((e) => e.membershipId === "mem-bob")).toHaveLength(1);
  });
});
