import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSeasonFindUnique = vi.fn();
const mockPickFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    season: { findUnique: (...args: unknown[]) => mockSeasonFindUnique(...args) },
    pick: { findMany: (...args: unknown[]) => mockPickFindMany(...args) },
  },
}));

import { keepCheckedLines } from "./lines";
import { buildCommentaryView, loadFreshPickCells, publicDisplayName } from "./view";

const ARGS = { leagueId: "lg-1", nflSeasonYear: 2026, weekNumber: 4 };

function pick(overrides: Record<string, unknown> = {}) {
  return {
    outcome: "WIN",
    pointsEarned: 2,
    nflWeekNumber: 4,
    team: { abbreviation: "PHI" },
    leagueMembership: {
      leaguePerson: { id: "person-1" },
      user: { name: "Alex" },
    },
    ...overrides,
  };
}

describe("buildCommentaryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSeasonFindUnique.mockResolvedValue({ id: "season-1" });
    mockPickFindMany.mockResolvedValue([
      pick(),
      pick({
        outcome: null,
        pointsEarned: null,
        leagueMembership: { leaguePerson: { id: "person-2" }, user: { name: "Sam" } },
      }),
      pick({
        leagueMembership: {
          leaguePerson: { id: "person-3" },
          user: { name: "sam@example.com" },
        },
      }),
    ]);
  });

  it("builds this week's person, outcome, points, and team without secrets", async () => {
    const view = await buildCommentaryView(ARGS);

    expect(mockPickFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          seasonId: "season-1",
          nflWeekNumber: 4,
          outcome: { not: null },
          pointsEarned: { not: null },
        },
      }),
    );
    const select = JSON.stringify(mockPickFindMany.mock.calls[0]?.[0].select);
    expect(select).not.toContain("email");
    expect(select).not.toContain("password");
    expect(select).not.toContain("session");
    expect(view).toEqual([
      {
        leaguePersonId: "person-1",
        displayName: "Alex",
        year: 2026,
        week: 4,
        outcome: "WIN",
        points: 2,
        teamAbbreviation: "PHI",
      },
      {
        leaguePersonId: "person-3",
        displayName: null,
        year: 2026,
        week: 4,
        outcome: "WIN",
        points: 2,
        teamAbbreviation: "PHI",
      },
    ]);
    expect(JSON.stringify(view)).not.toContain("@");
    expect(publicDisplayName("  Alex  ")).toBe("Alex");
    expect(publicDisplayName("a@b.com")).toBeNull();
  });
});

describe("loadFreshPickCells", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSeasonFindUnique.mockResolvedValue({ id: "season-1" });
  });

  it("matches cited cells against a fresh read, not the object passed to the model", async () => {
    const viewPassedToModel = [
      {
        leaguePersonId: "person-1",
        displayName: "Alex",
        year: 2026,
        week: 4,
        outcome: "WIN" as const,
        points: 2,
        teamAbbreviation: "PHI",
      },
    ];
    mockPickFindMany.mockResolvedValue([
      pick({ outcome: "LOSS", pointsEarned: 0, leagueMembership: { leaguePerson: { id: "person-1" } } }),
    ]);

    const fresh = await loadFreshPickCells(ARGS);
    const sentence = "Alex won the week.";
    const kept = keepCheckedLines(
      [
        {
          sentence,
          cells: [
            {
              leaguePersonId: "person-1",
              year: 2026,
              week: 4,
              outcome: "WIN",
              points: 2,
              teamAbbreviation: "PHI",
            },
          ],
        },
      ],
      fresh,
    );

    expect(kept).toEqual([]);
    expect(viewPassedToModel[0]?.outcome).toBe("WIN");
    const select = JSON.stringify(mockPickFindMany.mock.calls[0]?.[0].select);
    expect(select).not.toContain("email");
    expect(select).not.toContain("password");
    expect(select).not.toContain("user");
  });
});
