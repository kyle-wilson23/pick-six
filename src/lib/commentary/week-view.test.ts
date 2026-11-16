import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSeasonFindMany = vi.fn();
const mockPickFindMany = vi.fn();
const mockBookRowFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    season: { findMany: (...args: unknown[]) => mockSeasonFindMany(...args) },
    pick: { findMany: (...args: unknown[]) => mockPickFindMany(...args) },
    bookRow: { findMany: (...args: unknown[]) => mockBookRowFindMany(...args) },
    user: { findMany: () => Promise.reject(new Error("user query")) },
  },
}));

import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";

import { loadCommentaryWeekView, type CommentaryWeekViewRow } from "./week-view";

const LEAGUE_ID = "league-1";

function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (value == null || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    for (const item of value) keysOf(item, found);
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    found.add(key);
    keysOf(child, found);
  }
  return found;
}

describe("loadCommentaryWeekView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSeasonFindMany.mockResolvedValue([]);
    mockPickFindMany.mockResolvedValue([]);
    mockBookRowFindMany.mockResolvedValue([]);
  });

  it("returns this week's scored pick when the book is empty", async () => {
    mockSeasonFindMany.mockResolvedValue([{ nflSeasonYear: 2026 }]);
    mockPickFindMany.mockResolvedValue([
      {
        nflWeekNumber: 4,
        outcome: "WIN",
        pointsEarned: 2,
        team: { abbreviation: "BUF" },
        season: { nflSeasonYear: 2026 },
        leagueMembership: {
          leaguePerson: { id: "person-1" },
          user: { name: "Alice", email: "alice@example.com" },
        },
      },
      {
        nflWeekNumber: 4,
        outcome: null,
        pointsEarned: null,
        team: { abbreviation: "NYJ" },
        season: { nflSeasonYear: 2026 },
        leagueMembership: {
          leaguePerson: { id: "person-2" },
          user: { name: "Bob", email: "bob@example.com" },
        },
      },
    ]);

    const rows = await loadCommentaryWeekView({
      leagueId: LEAGUE_ID,
      nflSeasonYear: 2026,
      weekNumber: 4,
    });

    expect(mockPickFindMany).toHaveBeenCalledWith({
      where: {
        outcome: { not: null },
        pointsEarned: { not: null },
        season: { leagueId: LEAGUE_ID, nflSeasonYear: { in: [2026] } },
        leagueMembership: leaguePlayerMembershipWhere(LEAGUE_ID),
      },
      select: {
        nflWeekNumber: true,
        outcome: true,
        pointsEarned: true,
        team: { select: { abbreviation: true } },
        season: { select: { nflSeasonYear: true } },
        leagueMembership: {
          select: {
            leaguePerson: { select: { id: true } },
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
    expect(mockBookRowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          leaguePerson: { membership: leaguePlayerMembershipWhere(LEAGUE_ID) },
          nflSeasonYear: { notIn: [2026] },
        },
      }),
    );
    expect(rows).toEqual([
      {
        personId: "person-1",
        userDisplayName: "Alice",
        year: 2026,
        week: 4,
        outcome: "WIN",
        points: 2,
        teamAbbreviation: "BUF",
      },
    ]);
  });

  it("uses a book row for a year with no season", async () => {
    mockSeasonFindMany.mockResolvedValue([{ nflSeasonYear: 2026 }]);
    mockBookRowFindMany.mockResolvedValue([
      {
        nflSeasonYear: 2024,
        weekNumber: 8,
        outcome: "LOSS",
        points: 0,
        team: { abbreviation: "KC" },
        leaguePerson: {
          id: "person-1",
          membership: { user: { name: "Alice", email: "alice@example.com" } },
        },
      },
    ]);

    const rows = await loadCommentaryWeekView({
      leagueId: LEAGUE_ID,
      nflSeasonYear: 2026,
      weekNumber: 4,
    });

    const bookRow: CommentaryWeekViewRow = {
      personId: "person-1",
      userDisplayName: "Alice",
      year: 2024,
      week: 8,
      outcome: "LOSS",
      points: 0,
      teamAbbreviation: "KC",
    };
    expect(rows).toEqual([bookRow]);
    expect(bookRow).not.toHaveProperty("pointsEarned");
    expect(bookRow).not.toHaveProperty("seasonId");
  });

  it("returns a scored pick and a book row for the same person", async () => {
    mockSeasonFindMany.mockResolvedValue([{ nflSeasonYear: 2026 }]);
    mockPickFindMany.mockResolvedValue([
      {
        nflWeekNumber: 4,
        outcome: "WIN",
        pointsEarned: 2,
        team: { abbreviation: "BUF" },
        season: { nflSeasonYear: 2026 },
        leagueMembership: {
          leaguePerson: { id: "person-1" },
          user: { name: "Alice", email: "alice@example.com" },
        },
      },
    ]);
    mockBookRowFindMany.mockResolvedValue([
      {
        nflSeasonYear: 2024,
        weekNumber: 8,
        outcome: "LOSS",
        points: 0,
        team: { abbreviation: "KC" },
        leaguePerson: {
          id: "person-1",
          membership: { user: { name: "Alice", email: "alice@example.com" } },
        },
      },
      {
        nflSeasonYear: 2026,
        weekNumber: 4,
        outcome: "WIN",
        points: 9,
        team: { abbreviation: "GB" },
        leaguePerson: {
          id: "person-1",
          membership: { user: { name: "Alice", email: "alice@example.com" } },
        },
      },
    ]);

    const rows = await loadCommentaryWeekView({
      leagueId: LEAGUE_ID,
      nflSeasonYear: 2026,
      weekNumber: 4,
    });

    expect(rows).toEqual([
      {
        personId: "person-1",
        userDisplayName: "Alice",
        year: 2026,
        week: 4,
        outcome: "WIN",
        points: 2,
        teamAbbreviation: "BUF",
      },
      {
        personId: "person-1",
        userDisplayName: "Alice",
        year: 2024,
        week: 8,
        outcome: "LOSS",
        points: 0,
        teamAbbreviation: "KC",
      },
    ]);
    expect(rows).not.toContainEqual(
      expect.objectContaining({ year: 2026, teamAbbreviation: "GB" }),
    );
  });

  it("uses the season pick and ignores book rows for a live year", async () => {
    mockSeasonFindMany.mockResolvedValue([{ nflSeasonYear: 2024 }, { nflSeasonYear: 2026 }]);
    mockPickFindMany.mockResolvedValue([
      {
        nflWeekNumber: 3,
        outcome: "WIN",
        pointsEarned: 2,
        team: { abbreviation: "BUF" },
        season: { nflSeasonYear: 2024 },
        leagueMembership: {
          leaguePerson: { id: "person-1" },
          user: { name: "Alice", email: "alice@example.com" },
        },
      },
      {
        nflWeekNumber: 4,
        outcome: "LOSS",
        pointsEarned: 0,
        team: { abbreviation: "DAL" },
        season: { nflSeasonYear: 2026 },
        leagueMembership: {
          leaguePerson: { id: "person-1" },
          user: { name: "Alice", email: "alice@example.com" },
        },
      },
    ]);
    mockBookRowFindMany.mockResolvedValue([
      {
        nflSeasonYear: 2024,
        weekNumber: 3,
        outcome: "LOSS",
        points: 1,
        team: { abbreviation: "NYJ" },
        leaguePerson: {
          id: "person-1",
          membership: { user: { name: "Alice", email: "alice@example.com" } },
        },
      },
      {
        nflSeasonYear: 2024,
        weekNumber: 9,
        outcome: "TIE",
        points: 0,
        team: { abbreviation: "PHI" },
        leaguePerson: {
          id: "person-1",
          membership: { user: { name: "Alice", email: "alice@example.com" } },
        },
      },
      {
        nflSeasonYear: 2026,
        weekNumber: 4,
        outcome: "WIN",
        points: 9,
        team: { abbreviation: "GB" },
        leaguePerson: {
          id: "person-1",
          membership: { user: { name: "Alice", email: "alice@example.com" } },
        },
      },
    ]);

    const rows = await loadCommentaryWeekView({
      leagueId: LEAGUE_ID,
      nflSeasonYear: 2026,
      weekNumber: 4,
    });

    expect(mockBookRowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ nflSeasonYear: { notIn: [2024, 2026] } }),
      }),
    );
    expect(rows).toEqual([
      {
        personId: "person-1",
        userDisplayName: "Alice",
        year: 2024,
        week: 3,
        outcome: "WIN",
        points: 2,
        teamAbbreviation: "BUF",
      },
      {
        personId: "person-1",
        userDisplayName: "Alice",
        year: 2026,
        week: 4,
        outcome: "LOSS",
        points: 0,
        teamAbbreviation: "DAL",
      },
    ]);
    expect(rows.filter((row) => row.year === 2026 && row.week === 4)).toHaveLength(1);
  });

  it("returns book rows when the league has no season", async () => {
    mockPickFindMany.mockRejectedValue(new Error("no live years"));
    mockBookRowFindMany.mockResolvedValue([
      {
        nflSeasonYear: 2024,
        weekNumber: 2,
        outcome: "WIN",
        points: 1,
        team: { abbreviation: "SF" },
        leaguePerson: {
          id: "person-1",
          membership: { user: { name: "Alice", email: "alice@example.com" } },
        },
      },
    ]);

    const rows = await loadCommentaryWeekView({
      leagueId: LEAGUE_ID,
      nflSeasonYear: 2026,
      weekNumber: 4,
    });

    expect(mockPickFindMany).not.toHaveBeenCalled();
    const bookWhere = mockBookRowFindMany.mock.calls[0][0].where;
    expect(bookWhere).not.toHaveProperty("nflSeasonYear");
    expect(rows).toEqual([
      {
        personId: "person-1",
        userDisplayName: "Alice",
        year: 2024,
        week: 2,
        outcome: "WIN",
        points: 1,
        teamAbbreviation: "SF",
      },
    ]);
  });

  it("returns a null team when the book row has no team", async () => {
    mockBookRowFindMany.mockResolvedValue([
      {
        nflSeasonYear: 2024,
        weekNumber: 1,
        outcome: "TIE",
        points: 0,
        team: null,
        leaguePerson: {
          id: "person-1",
          membership: { user: { name: "Alice", email: "alice@example.com" } },
        },
      },
    ]);

    const rows = await loadCommentaryWeekView({
      leagueId: LEAGUE_ID,
      nflSeasonYear: 2026,
      weekNumber: 4,
    });

    expect(rows).toEqual([
      {
        personId: "person-1",
        userDisplayName: "Alice",
        year: 2024,
        week: 1,
        outcome: "TIE",
        points: 0,
        teamAbbreviation: null,
      },
    ]);
  });

  it("hides email, user id, password, and session", async () => {
    mockSeasonFindMany.mockResolvedValue([{ nflSeasonYear: 2026 }]);
    mockPickFindMany.mockResolvedValue([
      {
        nflWeekNumber: 4,
        outcome: "WIN",
        pointsEarned: 2,
        team: { abbreviation: "BUF" },
        season: { nflSeasonYear: 2026 },
        leagueMembership: {
          leaguePerson: { id: "person-1" },
          user: {
            id: "user-1",
            name: null,
            email: "alice@example.com",
            passwordHash: "secret-hash",
            session: "session-token",
          },
        },
      },
      {
        nflWeekNumber: 5,
        outcome: "LOSS",
        pointsEarned: 0,
        team: { abbreviation: "DAL" },
        season: { nflSeasonYear: 2026 },
        leagueMembership: {
          leaguePerson: null,
          user: {
            id: "user-2",
            name: "Bob",
            email: "bob@example.com",
            passwordHash: "other-secret",
          },
        },
      },
    ]);
    mockBookRowFindMany.mockResolvedValue([
      {
        nflSeasonYear: 2023,
        weekNumber: 6,
        outcome: "LOSS",
        points: 0,
        team: { abbreviation: "NYJ" },
        leaguePerson: {
          id: "person-3",
          membership: {
            user: {
              id: "user-3",
              name: "cara@example.com",
              email: "cara@example.com",
              passwordHash: "book-secret",
              session: "book-session",
            },
          },
        },
      },
    ]);

    const rows = await loadCommentaryWeekView({
      leagueId: LEAGUE_ID,
      nflSeasonYear: 2026,
      weekNumber: 4,
    });

    expect(rows).toEqual([
      {
        personId: "person-1",
        userDisplayName: "Player",
        year: 2026,
        week: 4,
        outcome: "WIN",
        points: 2,
        teamAbbreviation: "BUF",
      },
      {
        personId: "person-3",
        userDisplayName: "Player",
        year: 2023,
        week: 6,
        outcome: "LOSS",
        points: 0,
        teamAbbreviation: "NYJ",
      },
    ]);
    const json = JSON.stringify(rows);
    expect(json).not.toContain("@");
    expect(json).not.toContain("user-1");
    expect(json).not.toContain("user-3");
    expect(json).not.toContain("secret");
    expect(json).not.toContain("session");
    expect(keysOf(rows)).toEqual(
      new Set([
        "personId",
        "userDisplayName",
        "year",
        "week",
        "outcome",
        "points",
        "teamAbbreviation",
      ]),
    );
    const userSelect = { name: true, email: true };
    expect(mockPickFindMany.mock.calls[0][0].select.leagueMembership.select.user.select).toEqual(
      userSelect,
    );
    expect(
      mockBookRowFindMany.mock.calls[0][0].select.leaguePerson.select.membership.select.user.select,
    ).toEqual(userSelect);
  });
});
