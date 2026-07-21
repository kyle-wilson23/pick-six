import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSeasonFindUnique = vi.fn();
const mockLeagueFindUnique = vi.fn();
const mockNflGameFindMany = vi.fn();
const mockNflWeekJailedFindUnique = vi.fn();
const mockTeamFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    season: { findUnique: (...args: unknown[]) => mockSeasonFindUnique(...args) },
    league: { findUnique: (...args: unknown[]) => mockLeagueFindUnique(...args) },
    nflGame: { findMany: (...args: unknown[]) => mockNflGameFindMany(...args) },
    nflWeekJailedTeam: {
      findUnique: (...args: unknown[]) => mockNflWeekJailedFindUnique(...args),
    },
    team: { findMany: (...args: unknown[]) => mockTeamFindMany(...args) },
  },
}));

import { getJailedVerification } from "./get-jailed-verification";
import { resolvePicksWeekNumber } from "@/lib/nfl/resolve-picks-week";

function auditPayload(overrides: Record<string, unknown> = {}) {
  return {
    v: 1 as const,
    jailedTeamId: "team-phi",
    resolvedBy: "MONEYLINE" as const,
    randomSeed: null,
    gamesInWeek: 4,
    gamesWithCompleteLines: 4,
    winningMoneylineAmerican: -200,
    tieLevel: "MONEYLINE" as const,
    candidates: [
      {
        nflGameId: "g1",
        homeTeamId: "team-phi",
        awayTeamId: "team-dal",
        homeMoneylineAmerican: -200,
        awayMoneylineAmerican: 170,
        homeSpreadPoints: -3.5,
        favoriteTeamId: "team-phi",
        favoriteMoneylineAmerican: -200,
        spreadInFavoriteFavor: 3.5,
      },
    ],
    ...overrides,
  };
}

describe("getJailedVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeagueFindUnique.mockResolvedValue({ isTestLeague: false });
    mockTeamFindMany.mockResolvedValue([
      { id: "team-phi", name: "Philadelphia Eagles" },
      { id: "team-dal", name: "Dallas Cowboys" },
    ]);
  });

  it("production league: resolved week matches resolvePicksWeekNumber (byte-identical path)", async () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    const season = {
      id: "season-1",
      nflSeasonYear: 2026,
      preSeasonInitializedAt: new Date("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: null,
    };
    const games = [
      { weekNumber: 1, kickoffAt: new Date("2026-09-11T20:00:00.000Z") },
      { weekNumber: 2, kickoffAt: new Date("2026-09-18T20:00:00.000Z") },
    ];
    mockSeasonFindUnique.mockResolvedValue(season);
    mockNflGameFindMany.mockResolvedValue(games);

    const expectedWeek = resolvePicksWeekNumber(
      {
        preSeasonInitializedAt: season.preSeasonInitializedAt,
        firstCompetitionWeek: season.firstCompetitionWeek,
      },
      games,
      now,
    );

    mockNflWeekJailedFindUnique.mockResolvedValue({
      jailedTeamId: "team-phi",
      jailedTeam: { id: "team-phi", name: "Philadelphia Eagles" },
      resolvedBy: "MONEYLINE",
      randomSeed: null,
      computedAt: new Date("2026-09-09T12:00:00.000Z"),
      auditJson: auditPayload(),
    });

    const view = await getJailedVerification({ leagueId: "league-1" }, undefined, now);

    expect(view).not.toBeNull();
    expect(view!.weekNumber).toBe(expectedWeek);
    expect(view!.weekNumber).toBe(1);
    expect(mockNflWeekJailedFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          nflSeasonYear_weekNumber: { nflSeasonYear: 2026, weekNumber: expectedWeek },
        },
      }),
    );
  });

  it("test league: week follows simulatedCurrentWeek regardless of now (AC6)", async () => {
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
    mockNflGameFindMany.mockResolvedValue([]);
    mockNflWeekJailedFindUnique.mockResolvedValue({
      jailedTeamId: "team-phi",
      jailedTeam: { id: "team-phi", name: "Philadelphia Eagles" },
      resolvedBy: "MONEYLINE",
      randomSeed: null,
      computedAt: new Date("2026-02-15T12:00:00.000Z"),
      auditJson: auditPayload(),
    });

    const view = await getJailedVerification({ leagueId: "league-test" }, undefined, now);

    expect(view).not.toBeNull();
    expect(view!.weekNumber).toBe(3);
    expect(mockNflWeekJailedFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          nflSeasonYear_weekNumber: { nflSeasonYear: 2026, weekNumber: 3 },
        },
      }),
    );
  });

  it("returns null when pre-season is not initialized", async () => {
    mockSeasonFindUnique.mockResolvedValue({
      id: "season-1",
      nflSeasonYear: 2026,
      preSeasonInitializedAt: null,
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: null,
    });

    const view = await getJailedVerification({ leagueId: "league-1" });
    expect(view).toBeNull();
    expect(mockNflGameFindMany).not.toHaveBeenCalled();
  });
});
