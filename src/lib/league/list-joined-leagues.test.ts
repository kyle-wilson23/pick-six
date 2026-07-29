import { LeagueMembershipRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { mapMembershipsToJoinedRows } from "./list-joined-leagues";

describe("mapMembershipsToJoinedRows", () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");

  it("preserves league name order when memberships are already sorted", () => {
    const rows = mapMembershipsToJoinedRows([
      {
        role: LeagueMembershipRole.MEMBER,
        lastVisitedAt: null,
        league: { id: "a", name: "Alpha", isTestLeague: false, createdAt, seasons: [] },
      },
      {
        role: LeagueMembershipRole.ADMIN,
        lastVisitedAt: null,
        league: { id: "b", name: "Beta", isTestLeague: true, createdAt, seasons: [] },
      },
    ]);
    expect(rows.map((r) => r.league.name)).toEqual(["Alpha", "Beta"]);
    expect(rows.map((r) => r.league.isTestLeague)).toEqual([false, true]);
  });

  it("sorts by most recently visited, then name", () => {
    const t1 = new Date("2026-07-01T12:00:00.000Z");
    const t2 = new Date("2026-07-15T12:00:00.000Z");
    const rows = mapMembershipsToJoinedRows([
      {
        role: LeagueMembershipRole.MEMBER,
        lastVisitedAt: null,
        league: { id: "a", name: "Alpha", isTestLeague: false, createdAt, seasons: [] },
      },
      {
        role: LeagueMembershipRole.MEMBER,
        lastVisitedAt: t2,
        league: { id: "b", name: "Beta", isTestLeague: false, createdAt, seasons: [] },
      },
      {
        role: LeagueMembershipRole.MEMBER,
        lastVisitedAt: t1,
        league: { id: "c", name: "Charlie", isTestLeague: false, createdAt, seasons: [] },
      },
    ]);
    expect(rows.map((r) => r.league.name)).toEqual(["Beta", "Charlie", "Alpha"]);
  });

  it("carries membership role for each league", () => {
    const rows = mapMembershipsToJoinedRows([
      {
        role: LeagueMembershipRole.ADMIN,
        lastVisitedAt: null,
        league: { id: "x", name: "Zed", isTestLeague: false, createdAt, seasons: [] },
      },
    ]);
    expect(rows[0]?.role).toBe(LeagueMembershipRole.ADMIN);
  });

  it("maps season chunk like administered leagues helper", () => {
    const updatedAt = new Date("2026-04-01T12:00:00.000Z");
    const rows = mapMembershipsToJoinedRows([
      {
        role: LeagueMembershipRole.MEMBER,
        lastVisitedAt: null,
        league: {
          id: "league-1",
          name: "Q",
          isTestLeague: true,
          createdAt,
          seasons: [
            {
              id: "season-1",
              nflSeasonYear: 2026,
              firstCompetitionWeek: 3,
              firstCompetitionWeekLockedAt: null,
              preSeasonInitializedAt: null,
              updatedAt,
            },
          ],
        },
      },
    ]);
    expect(rows[0]?.league.isTestLeague).toBe(true);
    expect(rows[0]?.season).toEqual({
      id: "season-1",
      nflSeasonYear: 2026,
      firstCompetitionWeek: 3,
      firstCompetitionWeekLockedAt: null,
      preSeasonInitializedAt: null,
      updatedAt,
    });
  });
});
