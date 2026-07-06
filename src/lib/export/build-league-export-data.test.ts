import { PickOutcome } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { buildLeagueExportData } from "./build-league-export-data";

const LEAGUE_ID = "league-1";
const SEASON_ID = "season-1";
const SEASON_YEAR = 2026;
const EXPORTED_AT = "2026-07-06T00:00:00.000Z";

function makePick(overrides: {
  leagueMembershipId: string;
  nflWeekNumber: number;
  outcome?: PickOutcome | null;
  pointsEarned?: number | null;
  scoredAt?: Date | null;
  antiJailedBonus?: boolean;
  team?: { abbreviation: string; name: string };
}) {
  return {
    leagueMembershipId: overrides.leagueMembershipId,
    nflWeekNumber: overrides.nflWeekNumber,
    antiJailedBonus: overrides.antiJailedBonus ?? false,
    outcome: overrides.outcome ?? null,
    pointsEarned: overrides.pointsEarned ?? null,
    scoredAt: overrides.scoredAt ?? null,
    team: overrides.team ?? { abbreviation: "DEN", name: "Denver Broncos" },
  };
}

function makePrisma({
  season = { id: SEASON_ID },
  memberships = [],
  picks = [],
  jailedRows = [],
}: {
  season?: { id: string } | null;
  memberships?: Array<{ id: string; email: string }>;
  picks?: ReturnType<typeof makePick>[];
  jailedRows?: Array<{
    weekNumber: number;
    jailedTeam: { abbreviation: string; name: string };
  }>;
} = {}) {
  return {
    season: {
      findUnique: vi.fn().mockResolvedValue(season),
    },
    leagueMembership: {
      findMany: vi.fn().mockResolvedValue(
        memberships.map((membership) => ({
          id: membership.id,
          user: { email: membership.email },
        })),
      ),
    },
    pick: {
      findMany: vi.fn().mockResolvedValue(picks),
    },
    nflWeekJailedTeam: {
      findMany: vi.fn().mockResolvedValue(jailedRows),
    },
  } as unknown as PrismaClient;
}

describe("buildLeagueExportData", () => {
  it("sorts participants by totalPoints desc, then email asc", async () => {
    const prisma = makePrisma({
      memberships: [
        { id: "mem-a", email: "zoe@example.com" },
        { id: "mem-b", email: "alice@example.com" },
        { id: "mem-c", email: "bob@example.com" },
      ],
      picks: [
        makePick({
          leagueMembershipId: "mem-a",
          nflWeekNumber: 1,
          outcome: PickOutcome.WIN,
          pointsEarned: 1,
          scoredAt: new Date("2026-09-01T00:00:00.000Z"),
        }),
        makePick({
          leagueMembershipId: "mem-b",
          nflWeekNumber: 1,
          outcome: PickOutcome.WIN,
          pointsEarned: 2,
          scoredAt: new Date("2026-09-01T00:00:00.000Z"),
        }),
        makePick({
          leagueMembershipId: "mem-c",
          nflWeekNumber: 1,
          outcome: PickOutcome.WIN,
          pointsEarned: 2,
          scoredAt: new Date("2026-09-01T00:00:00.000Z"),
        }),
      ],
    });

    const result = await buildLeagueExportData(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      exportedAtIso: EXPORTED_AT,
    });

    expect(result.participants.map((p) => p.email)).toEqual([
      "alice@example.com",
      "bob@example.com",
      "zoe@example.com",
    ]);
  });

  it("returns empty participants when no season exists", async () => {
    const prisma = makePrisma({
      season: null,
      memberships: [{ id: "mem-a", email: "alice@example.com" }],
    });

    const result = await buildLeagueExportData(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      exportedAtIso: EXPORTED_AT,
    });

    expect(result.participants).toEqual([]);
    expect(result.jailedByWeek).toEqual([]);
  });

  it("maps picks with exportTeamLabel from teamNameForExport", async () => {
    const prisma = makePrisma({
      memberships: [{ id: "mem-a", email: "alice@example.com" }],
      picks: [
        makePick({
          leagueMembershipId: "mem-a",
          nflWeekNumber: 3,
          team: { abbreviation: "TB", name: "Tampa Bay Buccaneers" },
        }),
      ],
    });

    const result = await buildLeagueExportData(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      exportedAtIso: EXPORTED_AT,
    });

    expect(result.participants[0]?.picksByWeek.get(3)).toMatchObject({
      exportTeamLabel: "Bucs",
      outcome: "PENDING",
      pointsEarned: null,
    });
  });

  it("sums scored picks only and excludes pending picks from total", async () => {
    const prisma = makePrisma({
      memberships: [{ id: "mem-a", email: "alice@example.com" }],
      picks: [
        makePick({
          leagueMembershipId: "mem-a",
          nflWeekNumber: 1,
          outcome: PickOutcome.WIN,
          pointsEarned: 1,
          scoredAt: new Date("2026-09-01T00:00:00.000Z"),
        }),
        makePick({
          leagueMembershipId: "mem-a",
          nflWeekNumber: 2,
          outcome: null,
          pointsEarned: null,
          scoredAt: null,
        }),
      ],
    });

    const result = await buildLeagueExportData(prisma, {
      leagueId: LEAGUE_ID,
      nflSeasonYear: SEASON_YEAR,
      exportedAtIso: EXPORTED_AT,
    });

    expect(result.participants[0]?.totalPoints).toBe(1);
  });
});
