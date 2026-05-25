import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSeasonFindUnique = vi.fn();
const mockNflGameFindMany = vi.fn();
const mockMembershipFindMany = vi.fn();
const mockPickFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    season: { findUnique: (...args: unknown[]) => mockSeasonFindUnique(...args) },
    nflGame: { findMany: (...args: unknown[]) => mockNflGameFindMany(...args) },
    leagueMembership: { findMany: (...args: unknown[]) => mockMembershipFindMany(...args) },
    pick: { findMany: (...args: unknown[]) => mockPickFindMany(...args) },
  },
}));

import { buildSubmissionStatus, mergeSubmissionStatusParticipants } from "./build-submission-status";

describe("mergeSubmissionStatusParticipants", () => {
  it("maps submitted member pick data and pending member null", () => {
    const updatedAt = new Date("2026-09-10T18:00:00.000Z");
    const memberships = [
      {
        id: "mem-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { id: "user-1", name: "Alice", email: "alice@x.com" },
      },
      {
        id: "mem-2",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        user: { id: "user-2", name: null, email: "bob@x.com" },
      },
    ];
    const picks = [
      {
        leagueMembershipId: "mem-1",
        antiJailedBonus: true,
        updatedAt,
        team: { name: "Buffalo Bills", abbreviation: "BUF" },
      },
    ];

    expect(mergeSubmissionStatusParticipants(memberships, picks)).toEqual([
      {
        membershipId: "mem-1",
        displayName: "Alice",
        userId: "user-1",
        submittedPick: {
          teamName: "Buffalo Bills",
          teamAbbreviation: "BUF",
          antiJailedBonus: true,
          updatedAt: "2026-09-10T18:00:00.000Z",
        },
      },
      {
        membershipId: "mem-2",
        displayName: "bob@x.com",
        userId: "user-2",
        submittedPick: null,
      },
    ]);
  });

  it("preserves membership order even when only the later member has a pick", () => {
    const memberships = [
      {
        id: "mem-admin",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { id: "u-admin", name: "Admin", email: "admin@x.com" },
      },
      {
        id: "mem-member",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        user: { id: "u-member", name: "Member", email: "member@x.com" },
      },
    ];
    const picks = [
      {
        leagueMembershipId: "mem-member",
        antiJailedBonus: false,
        updatedAt: new Date("2026-09-10T18:00:00.000Z"),
        team: { name: "Kansas City Chiefs", abbreviation: "KC" },
      },
    ];

    const result = mergeSubmissionStatusParticipants(memberships, picks);
    expect(result.map((p) => p.membershipId)).toEqual(["mem-admin", "mem-member"]);
    expect(result[0]?.submittedPick).toBeNull();
    expect(result[1]?.submittedPick?.teamName).toBe("Kansas City Chiefs");
  });
});

describe("buildSubmissionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns graceful null payload when no season exists", async () => {
    mockSeasonFindUnique.mockResolvedValue(null);

    const payload = await buildSubmissionStatus({ leagueId: "league-1" });

    expect(payload).toEqual({ weekNumber: null, participants: [] });
    expect(mockNflGameFindMany).not.toHaveBeenCalled();
  });

  it("returns graceful null payload when pre-season is not initialized", async () => {
    mockSeasonFindUnique.mockResolvedValue({
      id: "season-1",
      nflSeasonYear: 2026,
      preSeasonInitializedAt: null,
      firstCompetitionWeek: 1,
    });

    const payload = await buildSubmissionStatus({ leagueId: "league-1" });

    expect(payload).toEqual({ weekNumber: null, participants: [] });
    expect(mockNflGameFindMany).not.toHaveBeenCalled();
  });

  it("returns week and merged participants when season and games are active", async () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    mockSeasonFindUnique.mockResolvedValue({
      id: "season-1",
      nflSeasonYear: 2026,
      preSeasonInitializedAt: new Date("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
    });
    mockNflGameFindMany.mockResolvedValue([
      { weekNumber: 1, kickoffAt: new Date("2026-09-11T20:00:00.000Z") },
      { weekNumber: 2, kickoffAt: new Date("2026-09-18T20:00:00.000Z") },
    ]);
    mockMembershipFindMany.mockResolvedValue([
      {
        id: "mem-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { id: "user-1", name: "Alice", email: "alice@x.com" },
      },
      {
        id: "mem-2",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        user: { id: "user-2", name: "Bob", email: "bob@x.com" },
      },
    ]);
    mockPickFindMany.mockResolvedValue([
      {
        leagueMembershipId: "mem-1",
        antiJailedBonus: false,
        updatedAt: new Date("2026-09-09T15:00:00.000Z"),
        team: { name: "Kansas City Chiefs", abbreviation: "KC" },
      },
    ]);

    const payload = await buildSubmissionStatus({ leagueId: "league-1" }, now);

    expect(payload.weekNumber).toBe(1);
    expect(payload.participants).toHaveLength(2);
    expect(payload.participants[0]?.submittedPick?.teamName).toBe("Kansas City Chiefs");
    expect(payload.participants[1]?.submittedPick).toBeNull();
  });
});
