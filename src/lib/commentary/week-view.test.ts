import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPickFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    pick: { findMany: (...args: unknown[]) => mockPickFindMany(...args) },
    user: { findMany: () => Promise.reject(new Error("user query")) },
  },
}));

import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";

import { loadCommentaryWeekView } from "./week-view";

describe("loadCommentaryWeekView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns this week only, with no email or user id on the model view", async () => {
    mockPickFindMany.mockResolvedValue([
      {
        outcome: "WIN",
        pointsEarned: 2,
        team: { abbreviation: "BUF" },
        leagueMembership: {
          leaguePerson: { id: "person-1" },
          user: { name: "Alice", email: "alice@example.com" },
        },
      },
      {
        outcome: null,
        pointsEarned: null,
        team: { abbreviation: "NYJ" },
        leagueMembership: {
          leaguePerson: { id: "person-2" },
          user: { name: null, email: "bob@example.com" },
        },
      },
      {
        outcome: "LOSS",
        pointsEarned: 0,
        team: { abbreviation: "DAL" },
        leagueMembership: {
          leaguePerson: { id: "person-3" },
          user: { name: "", email: "cara@example.com" },
        },
      },
    ]);

    const rows = await loadCommentaryWeekView({
      leagueId: "league-1",
      nflSeasonYear: 2026,
      weekNumber: 4,
    });

    expect(mockPickFindMany).toHaveBeenCalledOnce();
    expect(mockPickFindMany).toHaveBeenCalledWith({
      where: {
        nflWeekNumber: 4,
        outcome: { not: null },
        pointsEarned: { not: null },
        season: { leagueId: "league-1", nflSeasonYear: 2026 },
        leagueMembership: leaguePlayerMembershipWhere("league-1"),
      },
      select: {
        outcome: true,
        pointsEarned: true,
        team: { select: { abbreviation: true } },
        leagueMembership: {
          select: {
            leaguePerson: { select: { id: true } },
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
    expect(rows).toEqual([
      {
        personId: "person-1",
        userDisplayName: "Alice",
        outcome: "WIN",
        points: 2,
        teamAbbreviation: "BUF",
      },
      {
        personId: "person-3",
        userDisplayName: "Player",
        outcome: "LOSS",
        points: 0,
        teamAbbreviation: "DAL",
      },
    ]);
    expect(rows[0]).not.toHaveProperty("email");
    expect(rows[0]).not.toHaveProperty("userId");
    expect(JSON.stringify(rows)).not.toContain("alice@example.com");
    expect(JSON.stringify(rows)).not.toContain("cara@example.com");
  });
});
