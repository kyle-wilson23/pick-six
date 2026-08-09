import { LeagueMembershipRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import {
  buildLeagueWeekPeerPickRows,
  getLeagueWeekPeerPicks,
  isLeagueWeekPeerPicksUnlocked,
} from "./get-league-week-peer-picks";

const DEADLINE = "2099-09-11T00:10:00.000Z";

describe("isLeagueWeekPeerPicksUnlocked", () => {
  it("is locked before the deadline", () => {
    expect(
      isLeagueWeekPeerPicksUnlocked({
        isPreview: false,
        pickDeadlineUtc: DEADLINE,
        now: new Date("2099-09-10T12:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("is unlocked strictly after the deadline", () => {
    expect(
      isLeagueWeekPeerPicksUnlocked({
        isPreview: false,
        pickDeadlineUtc: DEADLINE,
        now: new Date("2099-09-11T00:10:00.001Z"),
      }),
    ).toBe(true);
  });

  it("is locked at the exact deadline instant (now ≤ deadline)", () => {
    expect(
      isLeagueWeekPeerPicksUnlocked({
        isPreview: false,
        pickDeadlineUtc: DEADLINE,
        now: new Date(DEADLINE),
      }),
    ).toBe(false);
  });

  it("is locked in preview mode even after deadline", () => {
    expect(
      isLeagueWeekPeerPicksUnlocked({
        isPreview: true,
        pickDeadlineUtc: DEADLINE,
        now: new Date("2099-09-12T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("is locked when deadline is null", () => {
    expect(
      isLeagueWeekPeerPicksUnlocked({
        isPreview: false,
        pickDeadlineUtc: null,
        now: new Date("2099-09-12T00:00:00.000Z"),
      }),
    ).toBe(false);
  });
});

describe("buildLeagueWeekPeerPickRows", () => {
  it("includes all members, sorts A–Z, uses email when name unset, null team when no pick", () => {
    const rows = buildLeagueWeekPeerPickRows(
      [
        {
          id: "m-b",
          user: {
            name: "Bob Smith",
            email: "bob@example.com",
            image: "https://example.com/bob.jpg",
          },
        },
        {
          id: "m-a",
          user: { name: "Alice Adams", email: "alice@example.com", image: null },
        },
        {
          id: "m-c",
          user: { name: null, email: "charlie@example.com", image: null },
        },
      ],
      [
        {
          leagueMembershipId: "m-b",
          team: { abbreviation: "KC", name: "Kansas City Chiefs" },
        },
      ],
    );

    expect(rows.map((r) => r.displayName)).toEqual([
      "Alice Adams",
      "Bob Smith",
      "charlie@example.com",
    ]);
    expect(rows.map((r) => r.imageUrl)).toEqual([
      null,
      "https://example.com/bob.jpg",
      null,
    ]);
    expect(rows[0].team).toBeNull();
    expect(rows[1].team).toEqual({
      abbreviation: "KC",
      name: "Kansas City Chiefs",
    });
    expect(rows[2].team).toBeNull();
  });
});

describe("getLeagueWeekPeerPicks", () => {
  function makePrisma(args: {
    memberships: Array<{
      id: string;
      user: { name: string | null; email: string; image: string | null };
    }>;
    picks: Array<{
      leagueMembershipId: string;
      team: { abbreviation: string; name: string };
    }>;
  }) {
    return {
      leagueMembership: {
        findMany: vi.fn().mockResolvedValue(args.memberships),
      },
      pick: {
        findMany: vi.fn().mockResolvedValue(args.picks),
      },
    } as unknown as PrismaClient;
  }

  it("returns null before the deadline and does not query", async () => {
    const prisma = makePrisma({ memberships: [], picks: [] });
    const result = await getLeagueWeekPeerPicks(prisma, {
      leagueId: "league-1",
      seasonId: "season-1",
      weekNumber: 3,
      isPreview: false,
      pickDeadlineUtc: DEADLINE,
      now: new Date("2099-09-10T12:00:00.000Z"),
    });
    expect(result).toBeNull();
    expect(prisma.leagueMembership.findMany).not.toHaveBeenCalled();
    expect(prisma.pick.findMany).not.toHaveBeenCalled();
  });

  it("returns sorted rows after the deadline", async () => {
    const prisma = makePrisma({
      memberships: [
        {
          id: "m-2",
          user: { name: "Zoe", email: "z@example.com", image: null },
        },
        {
          id: "m-1",
          user: {
            name: "Ann",
            email: "a@example.com",
            image: "https://example.com/ann.jpg",
          },
        },
      ],
      picks: [
        {
          leagueMembershipId: "m-1",
          team: { abbreviation: "BUF", name: "Buffalo Bills" },
        },
      ],
    });

    const result = await getLeagueWeekPeerPicks(prisma, {
      leagueId: "league-1",
      seasonId: "season-1",
      weekNumber: 3,
      isPreview: false,
      pickDeadlineUtc: DEADLINE,
      now: new Date("2099-09-12T00:00:00.000Z"),
    });

    expect(result).toEqual([
      {
        membershipId: "m-1",
        displayName: "Ann",
        imageUrl: "https://example.com/ann.jpg",
        team: { abbreviation: "BUF", name: "Buffalo Bills" },
      },
      {
        membershipId: "m-2",
        displayName: "Zoe",
        imageUrl: null,
        team: null,
      },
    ]);
    expect(prisma.leagueMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          leagueId: "league-1",
          role: { in: [LeagueMembershipRole.ADMIN, LeagueMembershipRole.MEMBER] },
        },
      }),
    );
  });
});
