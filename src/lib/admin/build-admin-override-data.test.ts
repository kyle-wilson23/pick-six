import { beforeEach, describe, expect, it, vi } from "vitest";

import { computePickDeadlineUtc } from "@/lib/domain/pick-deadline";

const mockSeasonFindUnique = vi.fn();
const mockLeagueFindUnique = vi.fn();
const mockNflGameFindMany = vi.fn();
const mockLeagueSimGameFindMany = vi.fn();
const mockPickFindMany = vi.fn();
const mockNflWeekJailedFindUnique = vi.fn();
const mockLeagueWeekJailedFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    season: { findUnique: (...args: unknown[]) => mockSeasonFindUnique(...args) },
    league: { findUnique: (...args: unknown[]) => mockLeagueFindUnique(...args) },
    nflGame: { findMany: (...args: unknown[]) => mockNflGameFindMany(...args) },
    leagueSimGame: { findMany: (...args: unknown[]) => mockLeagueSimGameFindMany(...args) },
    pick: { findMany: (...args: unknown[]) => mockPickFindMany(...args) },
    nflWeekJailedTeam: {
      findUnique: (...args: unknown[]) => mockNflWeekJailedFindUnique(...args),
    },
    leagueWeekJailedTeam: {
      findUnique: (...args: unknown[]) => mockLeagueWeekJailedFindUnique(...args),
    },
  },
}));

import { buildAdminOverrideData } from "./build-admin-override-data";

function teamPair(weekNumber: number, kickoffAt: Date) {
  return {
    id: `g-${weekNumber}`,
    nflSeasonYear: 2026,
    weekNumber,
    homeTeamId: `home-${weekNumber}`,
    awayTeamId: `away-${weekNumber}`,
    kickoffAt,
    status: "SCHEDULED",
    homeScore: null,
    awayScore: null,
    finalizedAt: null,
    homeTeam: {
      id: `home-${weekNumber}`,
      name: `Home ${weekNumber}`,
      abbreviation: `H${weekNumber}`,
    },
    awayTeam: {
      id: `away-${weekNumber}`,
      name: `Away ${weekNumber}`,
      abbreviation: `A${weekNumber}`,
    },
  };
}

describe("buildAdminOverrideData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeagueFindUnique.mockResolvedValue({ isTestLeague: false });
    mockNflWeekJailedFindUnique.mockResolvedValue({ jailedTeamId: "jailed-1" });
    mockSeasonFindUnique.mockResolvedValue({
      id: "season-1",
      nflSeasonYear: 2026,
      preSeasonInitializedAt: new Date("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: null,
    });
  });

  it("omits open-window week rows from allSeasonPicks (including the override target)", async () => {
    const week1Kickoff = new Date("2026-09-11T20:00:00.000Z");
    const week2Kickoff = new Date("2026-09-18T20:00:00.000Z");
    // After week 1 kickoff (window closed) but before week 2's deadline (window open).
    const now = new Date("2026-09-12T12:00:00.000Z");
    const games = [teamPair(1, week1Kickoff), teamPair(2, week2Kickoff)];
    mockNflGameFindMany.mockImplementation((args: { where?: { weekNumber?: number } }) => {
      const weekNumber = args?.where?.weekNumber;
      const rows = weekNumber == null ? games : games.filter((g) => g.weekNumber === weekNumber);
      return Promise.resolve(rows);
    });
    mockPickFindMany.mockResolvedValue([
      { leagueMembershipId: "mem-target", nflWeekNumber: 1, teamId: "home-1" },
      { leagueMembershipId: "mem-target", nflWeekNumber: 2, teamId: "home-2" },
      { leagueMembershipId: "mem-other", nflWeekNumber: 2, teamId: "away-2" },
    ]);

    const payload = await buildAdminOverrideData({ leagueId: "league-1" }, now);

    expect(payload?.weekNumber).toBe(2);
    expect(payload?.pickWindowClosed).toBe(false);
    expect(payload?.allSeasonPicks).toEqual([
      { membershipId: "mem-target", nflWeekNumber: 1, teamId: "home-1" },
    ]);
  });

  it("keeps current-week teamIds after the window closes", async () => {
    const week1Kickoff = new Date("2026-09-11T20:00:00.000Z");
    const now = new Date(computePickDeadlineUtc(week1Kickoff).getTime() + 1);
    const games = [teamPair(1, week1Kickoff)];
    mockNflGameFindMany.mockResolvedValue(games);
    mockPickFindMany.mockResolvedValue([
      { leagueMembershipId: "mem-target", nflWeekNumber: 1, teamId: "home-1" },
    ]);

    const payload = await buildAdminOverrideData({ leagueId: "league-1" }, now);

    expect(payload?.weekNumber).toBe(1);
    expect(payload?.pickWindowClosed).toBe(true);
    expect(payload?.allSeasonPicks).toEqual([
      { membershipId: "mem-target", nflWeekNumber: 1, teamId: "home-1" },
    ]);
  });

  it("test league: includes prior-week teamIds after sim advance even when kickoffs are still in the future", async () => {
    const now = new Date("2026-08-26T16:00:00.000Z");
    const week1Kickoff = new Date("2026-09-11T20:00:00.000Z");
    const week2Kickoff = new Date("2026-09-18T20:00:00.000Z");
    mockLeagueFindUnique.mockResolvedValue({ isTestLeague: true });
    mockLeagueWeekJailedFindUnique.mockResolvedValue({ jailedTeamId: "jailed-1" });
    mockSeasonFindUnique.mockResolvedValue({
      id: "season-1",
      nflSeasonYear: 2026,
      preSeasonInitializedAt: new Date("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: 2,
    });
    const games = [teamPair(1, week1Kickoff), teamPair(2, week2Kickoff)];
    mockLeagueSimGameFindMany.mockImplementation((args: { where?: { weekNumber?: number } }) => {
      const weekNumber = args?.where?.weekNumber;
      const rows = weekNumber == null ? games : games.filter((g) => g.weekNumber === weekNumber);
      return Promise.resolve(rows);
    });
    mockPickFindMany.mockResolvedValue([
      { leagueMembershipId: "mem-target", nflWeekNumber: 1, teamId: "home-1" },
      { leagueMembershipId: "mem-target", nflWeekNumber: 2, teamId: "home-2" },
    ]);

    const payload = await buildAdminOverrideData({ leagueId: "league-1" }, now);

    expect(payload?.weekNumber).toBe(2);
    expect(payload?.pickWindowClosed).toBe(false);
    expect(payload?.allSeasonPicks).toEqual([
      { membershipId: "mem-target", nflWeekNumber: 1, teamId: "home-1" },
    ]);
  });
});
