import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSeasonFindUnique = vi.fn();
const mockLeagueFindUnique = vi.fn();
const mockNflGameFindMany = vi.fn();
const mockMembershipFindMany = vi.fn();
const mockPickFindMany = vi.fn();

const mockLeagueSimGameFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    season: { findUnique: (...args: unknown[]) => mockSeasonFindUnique(...args) },
    league: { findUnique: (...args: unknown[]) => mockLeagueFindUnique(...args) },
    nflGame: { findMany: (...args: unknown[]) => mockNflGameFindMany(...args) },
    leagueSimGame: { findMany: (...args: unknown[]) => mockLeagueSimGameFindMany(...args) },
    leagueMembership: { findMany: (...args: unknown[]) => mockMembershipFindMany(...args) },
    pick: { findMany: (...args: unknown[]) => mockPickFindMany(...args) },
  },
}));

import { computePickDeadlineUtc } from "@/lib/domain/pick-deadline";

import { buildSubmissionStatus, mergeSubmissionStatusParticipants } from "./build-submission-status";

describe("mergeSubmissionStatusParticipants", () => {
  it("maps submitted member pick data and pending member null", () => {
    const updatedAt = new Date("2026-09-10T18:00:00.000Z");
    const memberships = [
      {
        id: "mem-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: {
          id: "user-1",
          name: "Alice",
          email: "alice@x.com",
          image: "https://example.com/alice.jpg",
        },
      },
      {
        id: "mem-2",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        user: { id: "user-2", name: null, email: "bob@x.com", image: null },
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

    expect(
      mergeSubmissionStatusParticipants(memberships, picks, { revealTeamIdentity: true }),
    ).toEqual([
      {
        membershipId: "mem-1",
        displayName: "Alice",
        imageUrl: "https://example.com/alice.jpg",
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
        imageUrl: null,
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
        user: { id: "u-admin", name: "Admin", email: "admin@x.com", image: null },
      },
      {
        id: "mem-member",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        user: {
          id: "u-member",
          name: "Member",
          email: "member@x.com",
          image: null,
        },
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

    const result = mergeSubmissionStatusParticipants(memberships, picks, {
      revealTeamIdentity: true,
    });
    expect(result.map((p) => p.membershipId)).toEqual(["mem-admin", "mem-member"]);
    expect(result[0]?.submittedPick).toBeNull();
    expect(result[1]?.submittedPick).toMatchObject({ teamName: "Kansas City Chiefs" });
  });

  it("strips team identity for others while the window is open, keeping the viewer's own pick", () => {
    const updatedAt = new Date("2026-09-10T18:00:00.000Z");
    const memberships = [
      {
        id: "mem-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { id: "user-1", name: "Alice", email: "alice@x.com", image: null },
      },
      {
        id: "mem-2",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        user: { id: "user-2", name: "Bob", email: "bob@x.com", image: null },
      },
    ];
    const picks = [
      {
        leagueMembershipId: "mem-1",
        antiJailedBonus: true,
        updatedAt,
        team: { name: "Buffalo Bills", abbreviation: "BUF" },
      },
      {
        leagueMembershipId: "mem-2",
        antiJailedBonus: false,
        updatedAt,
        team: { name: "Kansas City Chiefs", abbreviation: "KC" },
      },
    ];

    const result = mergeSubmissionStatusParticipants(memberships, picks, {
      revealTeamIdentity: false,
      viewerUserId: "user-1",
    });

    expect(result[0]?.submittedPick).toEqual({
      teamName: "Buffalo Bills",
      teamAbbreviation: "BUF",
      antiJailedBonus: true,
      updatedAt: "2026-09-10T18:00:00.000Z",
    });
    expect(result[1]?.submittedPick).toEqual({
      updatedAt: "2026-09-10T18:00:00.000Z",
    });
    expect(result[1]?.submittedPick).not.toHaveProperty("teamName");
    expect(result[1]?.submittedPick).not.toHaveProperty("teamAbbreviation");
    expect(result[1]?.submittedPick).not.toHaveProperty("antiJailedBonus");
  });
});

describe("buildSubmissionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeagueFindUnique.mockResolvedValue({ isTestLeague: false });
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
      simulatedCurrentWeek: null,
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
      simulatedCurrentWeek: null,
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
    expect(payload.participants[0]?.submittedPick).toEqual({
      updatedAt: "2026-09-09T15:00:00.000Z",
    });
    expect(payload.participants[0]?.submittedPick).not.toHaveProperty("teamName");
    expect(payload.participants[1]?.submittedPick).toBeNull();
  });

  it("keeps the viewer's own team fields while the pick window is open", async () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    mockSeasonFindUnique.mockResolvedValue({
      id: "season-1",
      nflSeasonYear: 2026,
      preSeasonInitializedAt: new Date("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: null,
    });
    mockNflGameFindMany.mockResolvedValue([
      { weekNumber: 1, kickoffAt: new Date("2026-09-11T20:00:00.000Z") },
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
      {
        leagueMembershipId: "mem-2",
        antiJailedBonus: true,
        updatedAt: new Date("2026-09-09T16:00:00.000Z"),
        team: { name: "Buffalo Bills", abbreviation: "BUF" },
      },
    ]);

    const payload = await buildSubmissionStatus(
      { leagueId: "league-1", viewerUserId: "user-1" },
      now,
    );

    expect(payload.participants[0]?.submittedPick).toEqual({
      teamName: "Kansas City Chiefs",
      teamAbbreviation: "KC",
      antiJailedBonus: false,
      updatedAt: "2026-09-09T15:00:00.000Z",
    });
    expect(payload.participants[1]?.submittedPick).toEqual({
      updatedAt: "2026-09-09T16:00:00.000Z",
    });
  });

  it("restores full submittedPick after the pick window closes", async () => {
    const kickoff = new Date("2026-09-11T20:00:00.000Z");
    const now = new Date(computePickDeadlineUtc(kickoff).getTime() + 1);
    mockSeasonFindUnique.mockResolvedValue({
      id: "season-1",
      nflSeasonYear: 2026,
      preSeasonInitializedAt: new Date("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: null,
    });
    mockNflGameFindMany.mockResolvedValue([
      { weekNumber: 1, kickoffAt: kickoff },
      { weekNumber: 2, kickoffAt: new Date("2026-09-18T20:00:00.000Z") },
    ]);
    mockMembershipFindMany.mockResolvedValue([
      {
        id: "mem-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { id: "user-1", name: "Alice", email: "alice@x.com" },
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
    expect(payload.participants[0]?.submittedPick).toEqual({
      teamName: "Kansas City Chiefs",
      teamAbbreviation: "KC",
      antiJailedBonus: false,
      updatedAt: "2026-09-09T15:00:00.000Z",
    });
  });

  it("keeps teams locked at the exact deadline instant", async () => {
    const kickoff = new Date("2026-09-11T20:00:00.000Z");
    const now = computePickDeadlineUtc(kickoff);
    mockSeasonFindUnique.mockResolvedValue({
      id: "season-1",
      nflSeasonYear: 2026,
      preSeasonInitializedAt: new Date("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: null,
    });
    mockNflGameFindMany.mockResolvedValue([{ weekNumber: 1, kickoffAt: kickoff }]);
    mockMembershipFindMany.mockResolvedValue([
      {
        id: "mem-2",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        user: { id: "user-2", name: "Bob", email: "bob@x.com" },
      },
    ]);
    mockPickFindMany.mockResolvedValue([
      {
        leagueMembershipId: "mem-2",
        antiJailedBonus: false,
        updatedAt: new Date("2026-09-09T15:00:00.000Z"),
        team: { name: "Buffalo Bills", abbreviation: "BUF" },
      },
    ]);

    const payload = await buildSubmissionStatus({ leagueId: "league-1" }, now);

    expect(payload.participants[0]?.submittedPick).toEqual({
      updatedAt: "2026-09-09T15:00:00.000Z",
    });
    expect(payload.participants[0]?.submittedPick).not.toHaveProperty("teamName");
  });

  it("test league: weekNumber follows simulatedCurrentWeek regardless of now (AC5)", async () => {
    const now = new Date("2026-03-01T12:00:00.000Z");
    mockLeagueFindUnique.mockResolvedValue({ isTestLeague: true });
    mockSeasonFindUnique.mockResolvedValue({
      id: "season-1",
      nflSeasonYear: 2026,
      preSeasonInitializedAt: new Date("2026-02-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: 3,
      simulationWeekCount: 4,
    });
    mockLeagueSimGameFindMany.mockResolvedValue([]);
    mockMembershipFindMany.mockResolvedValue([
      {
        id: "mem-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { id: "user-1", name: "Alice", email: "alice@x.com" },
      },
    ]);
    mockPickFindMany.mockResolvedValue([]);

    const payload = await buildSubmissionStatus({ leagueId: "league-1" }, now);

    expect(payload.weekNumber).toBe(3);
    expect(payload.participants).toHaveLength(1);
    expect(mockNflGameFindMany).not.toHaveBeenCalled();
  });

  it("test league: redacts other members' teams while the sim week window is open", async () => {
    const kickoff = new Date("2026-09-11T20:00:00.000Z");
    const now = new Date("2026-09-10T12:00:00.000Z");
    mockLeagueFindUnique.mockResolvedValue({ isTestLeague: true });
    mockSeasonFindUnique.mockResolvedValue({
      id: "season-1",
      nflSeasonYear: 2026,
      preSeasonInitializedAt: new Date("2026-02-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: 3,
      simulationWeekCount: 4,
    });
    mockLeagueSimGameFindMany.mockResolvedValue([
      { weekNumber: 3, kickoffAt: kickoff },
    ]);
    mockMembershipFindMany.mockResolvedValue([
      {
        id: "mem-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { id: "user-1", name: "Alice", email: "alice@x.com" },
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

    expect(payload.weekNumber).toBe(3);
    expect(payload.participants[0]?.submittedPick).toEqual({
      updatedAt: "2026-09-09T15:00:00.000Z",
    });
    expect(payload.participants[0]?.submittedPick).not.toHaveProperty("teamName");
  });
});
