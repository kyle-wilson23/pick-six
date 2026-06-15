import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { getLeagueStandings } from "./get-league-standings";

const LEAGUE_ID = "league-1";
const SEASON_ID = "season-1";
const SEASON_YEAR = 2026;

function makePrisma({
  season = { id: SEASON_ID },
  memberships = [],
}: {
  season?: { id: string } | null;
  memberships?: Array<{
    id: string;
    user: { name: string | null; email: string };
    picks?: Array<{ outcome: string; pointsEarned: number | null }>;
  }>;
} = {}) {
  return {
    season: {
      findFirst: vi.fn().mockResolvedValue(season),
    },
    leagueMembership: {
      findMany: vi.fn().mockResolvedValue(
        memberships.map((m) => ({
          id: m.id,
          user: m.user,
          picks: m.picks ?? [],
        })),
      ),
    },
  } as unknown as PrismaClient;
}

describe("getLeagueStandings", () => {
  it("sorts multiple participants by totalPoints desc, then wins desc", async () => {
    const result = await getLeagueStandings(
      makePrisma({
        memberships: [
          {
            id: "mem-a",
            user: { name: "Alice", email: "alice@example.com" },
            picks: [
              { outcome: "WIN", pointsEarned: 1 },
              { outcome: "LOSS", pointsEarned: 0 },
            ],
          },
          {
            id: "mem-b",
            user: { name: "Bob", email: "bob@example.com" },
            picks: [
              { outcome: "WIN", pointsEarned: 2 },
              { outcome: "WIN", pointsEarned: 1 },
            ],
          },
          {
            id: "mem-c",
            user: { name: "Carol", email: "carol@example.com" },
            picks: [{ outcome: "WIN", pointsEarned: 1 }],
          },
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR },
    );

    expect(result.map((e) => e.membershipId)).toEqual(["mem-b", "mem-a", "mem-c"]);
    expect(result[0]).toMatchObject({ totalPoints: 3, wins: 2, losses: 0, rank: 1 });
    expect(result[1]).toMatchObject({ totalPoints: 1, wins: 1, losses: 1, rank: 2 });
    expect(result[2]).toMatchObject({ totalPoints: 1, wins: 1, losses: 0, rank: 2 });
  });

  it("shares rank on totalPoints tie and skips the next rank; displayName breaks sort tie", async () => {
    const result = await getLeagueStandings(
      makePrisma({
        memberships: [
          {
            id: "mem-a",
            user: { name: "Alice", email: "alice@example.com" },
            picks: [{ outcome: "WIN", pointsEarned: 2 }],
          },
          {
            id: "mem-b",
            user: { name: "Bob", email: "bob@example.com" },
            picks: [{ outcome: "WIN", pointsEarned: 2 }],
          },
          {
            id: "mem-c",
            user: { name: "Carol", email: "carol@example.com" },
            picks: [{ outcome: "WIN", pointsEarned: 1 }],
          },
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR },
    );

    // Alice sorts before Bob alphabetically (displayName tiebreaker within equal totalPoints + wins)
    expect(result.map((e) => e.membershipId)).toEqual(["mem-a", "mem-b", "mem-c"]);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(1);
    expect(result[2].rank).toBe(3);
  });

  it("includes member with no scored picks at bottom with zeros", async () => {
    const result = await getLeagueStandings(
      makePrisma({
        memberships: [
          {
            id: "mem-a",
            user: { name: "Alice", email: "alice@example.com" },
            picks: [{ outcome: "WIN", pointsEarned: 1 }],
          },
          {
            id: "mem-b",
            user: { name: "Bob", email: "bob@example.com" },
            picks: [],
          },
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR },
    );

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      membershipId: "mem-b",
      totalPoints: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      rank: 2,
    });
  });

  it("uses user.email when name is null, otherwise user.name", async () => {
    const result = await getLeagueStandings(
      makePrisma({
        memberships: [
          {
            id: "mem-a",
            user: { name: null, email: "anon@example.com" },
            picks: [],
          },
          {
            id: "mem-b",
            user: { name: "Bob", email: "bob@example.com" },
            picks: [],
          },
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR },
    );

    const anon = result.find((e) => e.membershipId === "mem-a");
    const bob = result.find((e) => e.membershipId === "mem-b");
    expect(anon?.displayName).toBe("anon@example.com");
    expect(bob?.displayName).toBe("Bob");
  });

  it("uses wins as secondary tiebreaker when totalPoints are equal", async () => {
    const result = await getLeagueStandings(
      makePrisma({
        memberships: [
          {
            id: "mem-a",
            user: { name: "Alice", email: "alice@example.com" },
            picks: [{ outcome: "WIN", pointsEarned: 2 }], // 1 win, 2 pts
          },
          {
            id: "mem-b",
            user: { name: "Bob", email: "bob@example.com" },
            picks: [
              { outcome: "WIN", pointsEarned: 1 },
              { outcome: "WIN", pointsEarned: 1 },
            ], // 2 wins, 2 pts
          },
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR },
    );

    // Bob has more wins with same totalPoints → sorts first; both share rank 1
    expect(result[0].membershipId).toBe("mem-b");
    expect(result[1].membershipId).toBe("mem-a");
    expect(result[0]).toMatchObject({ totalPoints: 2, wins: 2, rank: 1 });
    expect(result[1]).toMatchObject({ totalPoints: 2, wins: 1, rank: 1 });
  });

  it("returns all-zeros for every member when no season exists for the league", async () => {
    const result = await getLeagueStandings(
      makePrisma({
        season: null,
        memberships: [
          { id: "mem-a", user: { name: "Alice", email: "alice@example.com" } },
          { id: "mem-b", user: { name: "Bob", email: "bob@example.com" } },
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR },
    );

    expect(result).toHaveLength(2);
    for (const entry of result) {
      expect(entry.totalPoints).toBe(0);
      expect(entry.wins).toBe(0);
      expect(entry.losses).toBe(0);
      expect(entry.ties).toBe(0);
    }
  });

  it("returns empty array when league has no memberships", async () => {
    const result = await getLeagueStandings(makePrisma({ memberships: [] }), {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
    });

    expect(result).toEqual([]);
  });
});
