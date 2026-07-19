import { LeagueMembershipRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { describeSeasonForParticipant, mapMembershipsToJoinedRows } from "./list-joined-leagues";

describe("mapMembershipsToJoinedRows", () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");

  it("preserves league name order when memberships are already sorted", () => {
    const rows = mapMembershipsToJoinedRows([
      {
        role: LeagueMembershipRole.MEMBER,
        league: { id: "a", name: "Alpha", isTestLeague: false, createdAt, seasons: [] },
      },
      {
        role: LeagueMembershipRole.ADMIN,
        league: { id: "b", name: "Beta", isTestLeague: true, createdAt, seasons: [] },
      },
    ]);
    expect(rows.map((r) => r.league.name)).toEqual(["Alpha", "Beta"]);
    expect(rows.map((r) => r.league.isTestLeague)).toEqual([false, true]);
  });

  it("carries membership role for each league", () => {
    const rows = mapMembershipsToJoinedRows([
      {
        role: LeagueMembershipRole.ADMIN,
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

describe("describeSeasonForParticipant", () => {
  it("uses participant-friendly copy when the season row is missing", () => {
    const line = describeSeasonForParticipant({ nflSeasonYear: 2026, season: null });
    expect(line).toContain("does not have season details");
    expect(line).toContain("2026");
    expect(line).toContain("league admin");
  });

  it("notes NFL week when first competition week is after week 1", () => {
    const line = describeSeasonForParticipant({
      nflSeasonYear: 2026,
      season: {
        id: "s1",
        nflSeasonYear: 2026,
        firstCompetitionWeek: 5,
        firstCompetitionWeekLockedAt: null,
        preSeasonInitializedAt: null,
        updatedAt: new Date(),
      },
    });
    expect(line).toContain("Competition starts NFL Week 5");
  });

  it("notes when competition start is locked", () => {
    const line = describeSeasonForParticipant({
      nflSeasonYear: 2026,
      season: {
        id: "s1",
        nflSeasonYear: 2026,
        firstCompetitionWeek: 1,
        firstCompetitionWeekLockedAt: new Date("2026-09-15T00:00:00.000Z"),
        preSeasonInitializedAt: null,
        updatedAt: new Date(),
      },
    });
    expect(line).toContain("Competition start is locked");
  });
});
