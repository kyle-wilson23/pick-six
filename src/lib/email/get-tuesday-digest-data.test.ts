import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLeagueFindUnique = vi.fn();
const mockSeasonFindUnique = vi.fn();
const mockNflGameFindMany = vi.fn();
const mockLeagueSimGameFindMany = vi.fn();
const mockNflWeekJailedTeamFindUnique = vi.fn();
const mockLeagueWeekJailedTeamFindUnique = vi.fn();
const mockMembershipFindMany = vi.fn();
const mockGetLeagueStandings = vi.fn();
const mockGetAppBaseUrl = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    league: { findUnique: (...args: unknown[]) => mockLeagueFindUnique(...args) },
    season: { findUnique: (...args: unknown[]) => mockSeasonFindUnique(...args) },
    nflGame: { findMany: (...args: unknown[]) => mockNflGameFindMany(...args) },
    leagueSimGame: { findMany: (...args: unknown[]) => mockLeagueSimGameFindMany(...args) },
    nflWeekJailedTeam: {
      findUnique: (...args: unknown[]) => mockNflWeekJailedTeamFindUnique(...args),
    },
    leagueWeekJailedTeam: {
      findUnique: (...args: unknown[]) => mockLeagueWeekJailedTeamFindUnique(...args),
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

import { getTuesdayDigestData } from "./get-tuesday-digest-data";

const LEAGUE_ID = "league-1";
const SEASON_YEAR = 2026;

function seedActiveWeekFixtures() {
  mockLeagueFindUnique.mockResolvedValue({
    id: LEAGUE_ID,
    name: "Test League",
    isTestLeague: false,
  });
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

  it("propagates isTestLeague: true from the league row", async () => {
    mockLeagueFindUnique.mockResolvedValue({
      id: LEAGUE_ID,
      name: "Test League",
      isTestLeague: true,
    });
    mockSeasonFindUnique.mockResolvedValue({
      id: "season-1",
      nflSeasonYear: SEASON_YEAR,
      preSeasonInitializedAt: new Date("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: 3,
    });
    mockLeagueSimGameFindMany.mockResolvedValue([]);
    mockGetLeagueStandings.mockResolvedValue([]);
    mockLeagueWeekJailedTeamFindUnique.mockResolvedValue(null);
    mockMembershipFindMany.mockResolvedValue([]);

    const result = await getTuesdayDigestData({ leagueId: LEAGUE_ID });

    expect(result.isTestLeague).toBe(true);
  });

  it("sets isPreviewWeek true before the week's window-open instant", async () => {
    mockGetLeagueStandings.mockResolvedValue([]);
    mockNflWeekJailedTeamFindUnique.mockResolvedValue(null);
    mockMembershipFindMany.mockResolvedValue([]);
    mockNflGameFindMany.mockResolvedValue([
      { weekNumber: 1, kickoffAt: new Date("2026-09-08T23:20:00.000Z") },
    ]);

    const result = await getTuesdayDigestData(
      { leagueId: LEAGUE_ID },
      new Date("2026-08-08T12:00:00.000Z"),
    );

    expect(result.weekNumber).toBe(1);
    expect(result.isPreviewWeek).toBe(true);
  });

  it("sets isPreviewWeek false once the window has opened", async () => {
    mockGetLeagueStandings.mockResolvedValue([]);
    mockNflWeekJailedTeamFindUnique.mockResolvedValue(null);
    mockMembershipFindMany.mockResolvedValue([]);
    mockNflGameFindMany.mockResolvedValue([
      { weekNumber: 1, kickoffAt: new Date("2026-09-08T23:20:00.000Z") },
    ]);

    const result = await getTuesdayDigestData(
      { leagueId: LEAGUE_ID },
      new Date("2026-09-09T12:00:00.000Z"),
    );

    expect(result.weekNumber).toBe(1);
    expect(result.isPreviewWeek).toBe(false);
  });

  // FR26a: the Tuesday digest links to the pick page, so the week has to be active by the time the
  // digest lands — Tuesday 19:00 ET, which is before the deadline but after window open.
  it("sets isPreviewWeek false on digest night, before the deadline", async () => {
    mockGetLeagueStandings.mockResolvedValue([]);
    mockNflWeekJailedTeamFindUnique.mockResolvedValue(null);
    mockMembershipFindMany.mockResolvedValue([]);
    mockNflGameFindMany.mockResolvedValue([
      { weekNumber: 1, kickoffAt: new Date("2026-09-08T23:20:00.000Z") },
    ]);

    const result = await getTuesdayDigestData(
      { leagueId: LEAGUE_ID },
      new Date("2026-09-08T23:00:00.000Z"),
    );

    expect(result.weekNumber).toBe(1);
    expect(result.isPreviewWeek).toBe(false);
  });

  it("test league: weekNumber follows simulatedCurrentWeek regardless of now", async () => {
    const now = new Date("2026-03-01T12:00:00.000Z");
    mockLeagueFindUnique.mockResolvedValue({
      id: LEAGUE_ID,
      name: "Test League",
      isTestLeague: true,
    });
    mockSeasonFindUnique.mockResolvedValue({
      id: "season-1",
      nflSeasonYear: SEASON_YEAR,
      preSeasonInitializedAt: new Date("2026-02-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: 3,
      simulationWeekCount: 4,
    });
    mockLeagueSimGameFindMany.mockResolvedValue([]);
    mockGetLeagueStandings.mockResolvedValue([]);
    mockLeagueWeekJailedTeamFindUnique.mockResolvedValue(null);
    mockMembershipFindMany.mockResolvedValue([]);

    const result = await getTuesdayDigestData({ leagueId: LEAGUE_ID }, now);

    expect(result.weekNumber).toBe(3);
    expect(result.isTestLeague).toBe(true);
  });
});
