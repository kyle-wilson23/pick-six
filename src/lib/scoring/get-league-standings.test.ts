import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { getLeagueStandings } from "./get-league-standings";

const LEAGUE_ID = "league-1";
const SEASON_ID = "season-1";
const SEASON_YEAR = 2026;

const SCORED_AT = new Date("2026-09-15T00:00:00.000Z");

function makePrisma({
  season = { id: SEASON_ID, firstCompetitionWeek: 1 },
  league = { isTestLeague: false },
  games = [],
  simGames = [],
  memberships = [],
}: {
  season?: { id: string; firstCompetitionWeek?: number } | null;
  league?: { isTestLeague: boolean } | null;
  games?: Array<{ weekNumber: number; status: string }>;
  simGames?: Array<{ weekNumber: number; status: string }>;
  memberships?: Array<{
    id: string;
    user: { name: string | null; email: string; image?: string | null };
    picks?: Array<{
      outcome: string | null;
      pointsEarned: number | null;
      nflWeekNumber?: number;
      scoredAt?: Date | null;
    }>;
  }>;
} = {}) {
  return {
    season: {
      findFirst: vi.fn().mockResolvedValue(
        season == null ? null : { firstCompetitionWeek: 1, ...season },
      ),
    },
    league: {
      findUnique: vi.fn().mockResolvedValue(league),
    },
    nflGame: {
      findMany: vi.fn().mockResolvedValue(games),
    },
    leagueSimGame: {
      findMany: vi.fn().mockResolvedValue(simGames),
    },
    leagueMembership: {
      findMany: vi.fn().mockResolvedValue(
        memberships.map((m) => ({
          id: m.id,
          user: { image: null, ...m.user },
          picks: (m.picks ?? []).map((pick, index) => ({
            nflWeekNumber: pick.nflWeekNumber ?? index + 1,
            outcome: pick.outcome,
            pointsEarned: pick.pointsEarned,
            scoredAt: pick.scoredAt === undefined ? SCORED_AT : pick.scoredAt,
          })),
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
      missedWeeks: 0,
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
    expect(anon?.imageUrl).toBeNull();
    expect(bob?.imageUrl).toBeNull();
  });

  it("maps user.image onto imageUrl", async () => {
    const result = await getLeagueStandings(
      makePrisma({
        memberships: [
          {
            id: "mem-a",
            user: {
              name: "Alice",
              email: "alice@example.com",
              image: "https://example.com/a.jpg",
            },
            picks: [],
          },
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR },
    );

    expect(result[0]?.imageUrl).toBe("https://example.com/a.jpg");
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
      expect(entry.missedWeeks).toBe(0);
    }
  });

  it("counts Jack's missed finalized week without adding a valid loss", async () => {
    const prisma = makePrisma({
      games: [
        { weekNumber: 1, status: "FINAL" },
        { weekNumber: 2, status: "FINAL" },
        { weekNumber: 3, status: "FINAL" },
      ],
      memberships: [
        {
          id: "mem-jack",
          user: { name: "Jack Quirke", email: "jack@example.com" },
          picks: [
            { outcome: "WIN", pointsEarned: 1, nflWeekNumber: 1 },
            { outcome: "WIN", pointsEarned: 1, nflWeekNumber: 3 },
          ],
        },
      ],
    });

    const result = await getLeagueStandings(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
    });

    expect(result[0]).toMatchObject({
      displayName: "Jack Quirke",
      totalPoints: 2,
      wins: 2,
      losses: 0,
      ties: 0,
      missedWeeks: 1,
    });

    const membershipQuery = vi.mocked(prisma.leagueMembership.findMany).mock.calls[0]?.[0] as
      | {
          include?: {
            picks?: {
              where?: { seasonId?: string; scoredAt?: unknown };
              select?: Record<string, boolean>;
            };
          };
        }
      | undefined;
    expect(membershipQuery?.include?.picks?.where).toEqual({ seasonId: SEASON_ID });
    expect(membershipQuery?.include?.picks?.select).toEqual({
      nflWeekNumber: true,
      outcome: true,
      pointsEarned: true,
      scoredAt: true,
    });
  });

  it("does not count an open week as a miss", async () => {
    const result = await getLeagueStandings(
      makePrisma({
        games: [
          { weekNumber: 1, status: "FINAL" },
          { weekNumber: 2, status: "SCHEDULED" },
        ],
        memberships: [
          {
            id: "mem-jack",
            user: { name: "Jack Quirke", email: "jack@example.com" },
            picks: [{ outcome: "WIN", pointsEarned: 1, nflWeekNumber: 1 }],
          },
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR },
    );

    expect(result[0]).toMatchObject({ wins: 1, losses: 0, missedWeeks: 0, totalPoints: 1 });
  });

  it("does not count a finalized week before firstCompetitionWeek", async () => {
    const result = await getLeagueStandings(
      makePrisma({
        season: { id: SEASON_ID, firstCompetitionWeek: 3 },
        games: [
          { weekNumber: 1, status: "FINAL" },
          { weekNumber: 2, status: "FINAL" },
          { weekNumber: 3, status: "FINAL" },
        ],
        memberships: [
          {
            id: "mem-jack",
            user: { name: "Jack Quirke", email: "jack@example.com" },
            picks: [{ outcome: "WIN", pointsEarned: 1, nflWeekNumber: 3 }],
          },
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR },
    );

    expect(result[0]).toMatchObject({ wins: 1, losses: 0, missedWeeks: 0 });
  });

  it("does not treat a saved unscored pick as a miss or a valid loss", async () => {
    const result = await getLeagueStandings(
      makePrisma({
        games: [
          { weekNumber: 1, status: "FINAL" },
          { weekNumber: 2, status: "FINAL" },
        ],
        memberships: [
          {
            id: "mem-jack",
            user: { name: "Jack Quirke", email: "jack@example.com" },
            picks: [
              { outcome: "WIN", pointsEarned: 1, nflWeekNumber: 1 },
              {
                outcome: "LOSS",
                pointsEarned: 9,
                nflWeekNumber: 2,
                scoredAt: null,
              },
            ],
          },
        ],
      }),
      { leagueId: LEAGUE_ID, nflSeasonYear: SEASON_YEAR },
    );

    expect(result[0]).toMatchObject({
      wins: 1,
      losses: 0,
      ties: 0,
      missedWeeks: 0,
      totalPoints: 1,
    });
  });

  it("sets missedWeeks to 0 when the league row is missing", async () => {
    const prisma = makePrisma({
      league: null,
      games: [{ weekNumber: 1, status: "FINAL" }],
      memberships: [
        {
          id: "mem-a",
          user: { name: "Alice", email: "alice@example.com" },
          picks: [],
        },
      ],
    });

    const result = await getLeagueStandings(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
    });

    expect(result[0]?.missedWeeks).toBe(0);
    expect(vi.mocked(prisma.nflGame.findMany)).not.toHaveBeenCalled();
  });

  it("counts missed weeks from sim games for a test league", async () => {
    const prisma = makePrisma({
      league: { isTestLeague: true },
      games: [],
      simGames: [{ weekNumber: 2, status: "FINAL" }],
      memberships: [
        {
          id: "mem-a",
          user: { name: "Alice", email: "alice@example.com" },
          picks: [],
        },
      ],
    });

    const result = await getLeagueStandings(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
    });

    expect(result[0]?.missedWeeks).toBe(1);
    expect(result[0]?.losses).toBe(0);
    expect(vi.mocked(prisma.leagueSimGame.findMany)).toHaveBeenCalled();
    expect(vi.mocked(prisma.nflGame.findMany)).not.toHaveBeenCalled();
  });

  it("returns empty array when league has no memberships", async () => {
    const result = await getLeagueStandings(makePrisma({ memberships: [] }), {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
    });

    expect(result).toEqual([]);
  });
});
