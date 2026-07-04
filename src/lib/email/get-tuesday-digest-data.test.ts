import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLeagueFindUnique = vi.fn();
const mockSeasonFindUnique = vi.fn();
const mockNflGameFindMany = vi.fn();
const mockNflWeekJailedTeamFindUnique = vi.fn();
const mockMembershipFindMany = vi.fn();
const mockGetLeagueStandings = vi.fn();
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
  },
}));

vi.mock("@/lib/scoring/get-league-standings", () => ({
  getLeagueStandings: (...args: unknown[]) => mockGetLeagueStandings(...args),
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

import { getTuesdayDigestData } from "./get-tuesday-digest-data";

const LEAGUE_ID = "league-1";
const SEASON_YEAR = 2026;

function seedActiveWeekFixtures() {
  mockLeagueFindUnique.mockResolvedValue({ id: LEAGUE_ID, name: "Test League" });
  mockSeasonFindUnique.mockResolvedValue({
    id: "season-1",
    nflSeasonYear: SEASON_YEAR,
    preSeasonInitializedAt: new Date("2026-08-01T00:00:00.000Z"),
    firstCompetitionWeek: 1,
  });
  mockNflGameFindMany.mockResolvedValue([
    { weekNumber: 3, kickoffAt: new Date("2026-09-15T00:00:00.000Z") },
  ]);
  mockGetAppBaseUrl.mockReturnValue("http://localhost:3000");
}

describe("getTuesdayDigestData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedActiveWeekFixtures();
  });

  it("returns jailed team name and abbreviation when present", async () => {
    mockGetLeagueStandings.mockResolvedValue([
      {
        membershipId: "mem-1",
        displayName: "Alice",
        totalPoints: 5,
        wins: 5,
        losses: 0,
        ties: 0,
        rank: 1,
      },
    ]);
    mockNflWeekJailedTeamFindUnique.mockResolvedValue({
      jailedTeam: { name: "New York Jets", abbreviation: "NYJ" },
    });
    mockMembershipFindMany.mockResolvedValue([
      {
        id: "mem-1",
        user: { email: "alice@example.com", name: "Alice" },
      },
    ]);

    const result = await getTuesdayDigestData({ leagueId: LEAGUE_ID });

    expect(result.jailedTeamName).toBe("New York Jets");
    expect(result.jailedTeamAbbreviation).toBe("NYJ");
    expect(result.weekNumber).toBe(3);
    expect(result.picksUrl).toBe(`http://localhost:3000/leagues/${LEAGUE_ID}/picks`);
  });

  it("returns null jailed team fields when not computed for the week", async () => {
    mockGetLeagueStandings.mockResolvedValue([]);
    mockNflWeekJailedTeamFindUnique.mockResolvedValue(null);
    mockMembershipFindMany.mockResolvedValue([]);

    const result = await getTuesdayDigestData({ leagueId: LEAGUE_ID });

    expect(result.jailedTeamName).toBeNull();
    expect(result.jailedTeamAbbreviation).toBeNull();
    expect(result.standings).toEqual([]);
  });

  it("includes all league memberships with user email as recipients", async () => {
    mockGetLeagueStandings.mockResolvedValue([]);
    mockNflWeekJailedTeamFindUnique.mockResolvedValue(null);
    mockMembershipFindMany.mockResolvedValue([
      {
        id: "mem-1",
        user: { email: "alice@example.com", name: "Alice" },
      },
      {
        id: "mem-2",
        user: { email: "bob@example.com", name: null },
      },
    ]);

    const result = await getTuesdayDigestData({ leagueId: LEAGUE_ID });

    expect(result.members).toEqual([
      {
        membershipId: "mem-1",
        email: "alice@example.com",
        displayName: "Alice",
      },
      {
        membershipId: "mem-2",
        email: "bob@example.com",
        displayName: "bob@example.com",
      },
    ]);
  });
});
