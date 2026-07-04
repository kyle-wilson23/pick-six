import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLeagueFindUnique = vi.fn();
const mockSeasonFindUnique = vi.fn();
const mockNflGameFindMany = vi.fn();
const mockNflWeekJailedTeamFindUnique = vi.fn();
const mockMembershipFindMany = vi.fn();
const mockPickFindMany = vi.fn();
const mockGetAppBaseUrl = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    league: { findUnique: (...args: unknown[]) => mockLeagueFindUnique(...args) },
    season: { findUnique: (...args: unknown[]) => mockSeasonFindUnique(...args) },
    nflGame: { findMany: (...args: unknown[]) => mockNflGameFindMany(...args) },
    nflWeekJailedTeam: {
      findUnique: (...args: unknown[]) => mockNflWeekJailedTeamFindUnique(...args),
    },
    leagueMembership: { findMany: (...args: unknown[]) => mockMembershipFindMany(...args) },
    pick: { findMany: (...args: unknown[]) => mockPickFindMany(...args) },
  },
}));

vi.mock("@/lib/email/app-base-url", () => ({
  getAppBaseUrl: () => mockGetAppBaseUrl(),
}));

vi.mock("@/lib/nfl/resolve-picks-week", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/nfl/resolve-picks-week")>();
  return {
    ...actual,
    resolvePicksWeekNumber: vi.fn(() => 3),
  };
});

import { getReminderData } from "./get-reminder-data";

const LEAGUE_ID = "league-1";
const SEASON_ID = "season-1";
const SEASON_YEAR = 2026;

function seedActiveWeekFixtures() {
  mockLeagueFindUnique.mockResolvedValue({ id: LEAGUE_ID, name: "Test League" });
  mockSeasonFindUnique.mockResolvedValue({
    id: SEASON_ID,
    nflSeasonYear: SEASON_YEAR,
    preSeasonInitializedAt: new Date("2026-08-01T00:00:00.000Z"),
    firstCompetitionWeek: 1,
  });
  mockNflGameFindMany.mockResolvedValue([
    { weekNumber: 3, kickoffAt: new Date("2026-09-15T00:00:00.000Z") },
  ]);
  mockGetAppBaseUrl.mockReturnValue("http://localhost:3000");
}

describe("getReminderData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedActiveWeekFixtures();
    mockNflWeekJailedTeamFindUnique.mockResolvedValue(null);
  });

  it("includes member with no pick in outstandingMembers", async () => {
    mockMembershipFindMany.mockResolvedValue([
      {
        id: "mem-1",
        user: { email: "alice@example.com", name: "Alice" },
      },
      {
        id: "mem-2",
        user: { email: "bob@example.com", name: "Bob" },
      },
    ]);
    mockPickFindMany.mockResolvedValue([{ leagueMembershipId: "mem-1" }]);

    const result = await getReminderData({ leagueId: LEAGUE_ID });

    expect(result.outstandingMembers).toEqual([
      {
        membershipId: "mem-2",
        email: "bob@example.com",
        displayName: "Bob",
      },
    ]);
    expect(result.submittedCount).toBe(1);
  });

  it("excludes members who have already submitted", async () => {
    mockMembershipFindMany.mockResolvedValue([
      {
        id: "mem-1",
        user: { email: "alice@example.com", name: "Alice" },
      },
    ]);
    mockPickFindMany.mockResolvedValue([{ leagueMembershipId: "mem-1" }]);

    const result = await getReminderData({ leagueId: LEAGUE_ID });

    expect(result.outstandingMembers).toEqual([]);
    expect(result.submittedCount).toBe(1);
  });

  it("returns empty outstandingMembers when all members have submitted", async () => {
    mockMembershipFindMany.mockResolvedValue([
      {
        id: "mem-1",
        user: { email: "alice@example.com", name: "Alice" },
      },
      {
        id: "mem-2",
        user: { email: "bob@example.com", name: "Bob" },
      },
    ]);
    mockPickFindMany.mockResolvedValue([
      { leagueMembershipId: "mem-1" },
      { leagueMembershipId: "mem-2" },
    ]);

    const result = await getReminderData({ leagueId: LEAGUE_ID });

    expect(result.outstandingMembers).toEqual([]);
    expect(result.submittedCount).toBe(2);
  });

  it("returns null jailed team fields when not computed for the week", async () => {
    mockMembershipFindMany.mockResolvedValue([]);
    mockPickFindMany.mockResolvedValue([]);
    mockNflWeekJailedTeamFindUnique.mockResolvedValue(null);

    const result = await getReminderData({ leagueId: LEAGUE_ID });

    expect(result.jailedTeamName).toBeNull();
    expect(result.jailedTeamAbbreviation).toBeNull();
    expect(result.picksUrl).toBe(`http://localhost:3000/leagues/${LEAGUE_ID}/picks`);
  });
});
