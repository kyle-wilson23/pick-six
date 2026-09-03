import { describe, expect, it } from "vitest";

import { formatInTimeZone } from "date-fns-tz";

import { computePickDeadlineUtc } from "@/lib/domain/pick-deadline";
import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";
import { SEASON_2026_OPENERS, easternLocal } from "@/test/season-2026-openers";

import {
  computePickWindowOpenUtc,
  computePicksUiIsPreview,
  resolveActiveWeekNumber,
  resolvePicksWeekNumber,
  type MinimalNflGameForPicksWeek,
  type MinimalSeasonForPicksWeek,
} from "./resolve-picks-week";

const d = (iso: string) => new Date(iso);

const TZ = LEAGUE_BUSINESS_TIMEZONE;

/** `America/New_York` wall clock of `at`, as `yyyy-MM-dd HH:mm`. */
function easternWall(at: Date): string {
  return formatInTimeZone(at, TZ, "yyyy-MM-dd HH:mm");
}

describe("resolvePicksWeekNumber", () => {
  it("pre-season (no season row): uses default first competition week when games exist", () => {
    const games: MinimalNflGameForPicksWeek[] = [
      { weekNumber: 1, kickoffAt: d("2026-09-10T00:20:00.000Z") },
    ];
    expect(resolvePicksWeekNumber(null, games, d("2026-03-01T12:00:00.000Z"))).toBe(1);
  });

  it("pre-season: uses season firstCompetitionWeek when season has no preSeasonInitializedAt", () => {
    const season: MinimalSeasonForPicksWeek = {
      preSeasonInitializedAt: null,
      firstCompetitionWeek: 4,
    };
    const games: MinimalNflGameForPicksWeek[] = [
      { weekNumber: 1, kickoffAt: d("2026-09-10T00:20:00.000Z") },
    ];
    expect(resolvePicksWeekNumber(season, games, d("2026-03-01T12:00:00.000Z"))).toBe(4);
  });

  it("in-season: returns lowest week with a future kickoff when >= firstCompetitionWeek", () => {
    const season: MinimalSeasonForPicksWeek = {
      preSeasonInitializedAt: d("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
    };
    const games: MinimalNflGameForPicksWeek[] = [
      { weekNumber: 1, kickoffAt: d("2026-09-04T00:20:00.000Z") },
      { weekNumber: 2, kickoffAt: d("2026-09-11T00:20:00.000Z") },
    ];
    expect(resolvePicksWeekNumber(season, games, d("2026-09-05T12:00:00.000Z"))).toBe(2);
  });

  it("post-season: all games past → last week with games", () => {
    const season: MinimalSeasonForPicksWeek = {
      preSeasonInitializedAt: d("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
    };
    const games: MinimalNflGameForPicksWeek[] = [
      { weekNumber: 1, kickoffAt: d("2026-09-04T00:20:00.000Z") },
      { weekNumber: 3, kickoffAt: d("2026-09-18T00:20:00.000Z") },
    ];
    expect(resolvePicksWeekNumber(season, games, d("2027-01-15T12:00:00.000Z"))).toBe(3);
  });

  it("mid-season start: future week < firstCompetitionWeek → clamp to firstCompetitionWeek", () => {
    const season: MinimalSeasonForPicksWeek = {
      preSeasonInitializedAt: d("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 5,
    };
    const games: MinimalNflGameForPicksWeek[] = [
      { weekNumber: 1, kickoffAt: d("2026-09-04T00:20:00.000Z") },
      { weekNumber: 2, kickoffAt: d("2026-09-11T00:20:00.000Z") },
    ];
    expect(resolvePicksWeekNumber(season, games, d("2026-09-05T12:00:00.000Z"))).toBe(5);
  });

  it("empty games list → firstCompetitionWeek", () => {
    const season: MinimalSeasonForPicksWeek = {
      preSeasonInitializedAt: d("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 3,
    };
    expect(resolvePicksWeekNumber(season, [], d("2026-09-01T12:00:00.000Z"))).toBe(3);
  });

  it("first future week equals firstCompetitionWeek", () => {
    const season: MinimalSeasonForPicksWeek = {
      preSeasonInitializedAt: d("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 5,
    };
    const games: MinimalNflGameForPicksWeek[] = [
      { weekNumber: 5, kickoffAt: d("2026-10-09T00:20:00.000Z") },
    ];
    expect(resolvePicksWeekNumber(season, games, d("2026-09-05T12:00:00.000Z"))).toBe(5);
  });
});

describe("computePickWindowOpenUtc", () => {
  it("opens the league's first competition week 7 days before its own first kickoff (FR26a)", () => {
    // 2026 Week 1 opens Wed Sep 9 20:15 ET, so the window opens Wed Sep 2 20:15 ET — a full week
    // of pick time despite the Wednesday opener.
    const open = computePickWindowOpenUtc({
      weekNumber: 1,
      firstCompetitionWeek: 1,
      allSeasonGames: SEASON_2026_OPENERS,
    });
    expect(easternWall(open!)).toBe("2026-09-02 20:15");
  });

  it("uses the 7-day lead for a mid-season first competition week too", () => {
    const open = computePickWindowOpenUtc({
      weekNumber: 5,
      firstCompetitionWeek: 5,
      allSeasonGames: SEASON_2026_OPENERS,
    });
    expect(easternWall(open!)).toBe("2026-10-01 20:15");
  });

  it("keeps the 7-day lead on the same ET wall clock across a DST transition", () => {
    // Week 9 kicks off Thu Nov 5 20:15 EST; seven calendar days earlier is Thu Oct 29, still EDT.
    // Subtracting a fixed 168 hours instead would open the window at 21:15 ET.
    const open = computePickWindowOpenUtc({
      weekNumber: 9,
      firstCompetitionWeek: 9,
      allSeasonGames: SEASON_2026_OPENERS,
    });
    expect(easternWall(open!)).toBe("2026-10-29 20:15");
  });

  it("opens later weeks at Tuesday 00:00 ET of the game week containing their first kickoff", () => {
    const cases: { weekNumber: number; expected: string }[] = [
      { weekNumber: 2, expected: "2026-09-15 00:00" },
      // Thanksgiving week's Wednesday opener anchors to its own Tuesday, not the prior week's.
      { weekNumber: 12, expected: "2026-11-24 00:00" },
      // Week 18 has no Thursday game; the Sunday opener still anchors to that Tuesday.
      { weekNumber: 18, expected: "2027-01-05 00:00" },
    ];
    for (const { weekNumber, expected } of cases) {
      const open = computePickWindowOpenUtc({
        weekNumber,
        firstCompetitionWeek: 1,
        allSeasonGames: SEASON_2026_OPENERS,
      });
      expect(easternWall(open!)).toBe(expected);
    }
  });

  it("opens at midnight, before the Tuesday 19:00 ET digest that links to the pick page", () => {
    const open = computePickWindowOpenUtc({
      weekNumber: 2,
      firstCompetitionWeek: 1,
      allSeasonGames: SEASON_2026_OPENERS,
    });
    expect(open!.getTime()).toBeLessThan(easternLocal(2026, 8, 15, 19, 0).getTime());
  });

  it("returns null when the week has no schedule data", () => {
    expect(
      computePickWindowOpenUtc({
        weekNumber: 19,
        firstCompetitionWeek: 1,
        allSeasonGames: SEASON_2026_OPENERS,
      }),
    ).toBeNull();
  });

  it("anchors on the week's earliest kickoff, not the first one listed", () => {
    const games: MinimalNflGameForPicksWeek[] = [
      { weekNumber: 2, kickoffAt: easternLocal(2026, 8, 20, 13, 0) },
      { weekNumber: 2, kickoffAt: easternLocal(2026, 8, 17, 20, 15) },
    ];
    const open = computePickWindowOpenUtc({
      weekNumber: 2,
      firstCompetitionWeek: 1,
      allSeasonGames: games,
    });
    expect(easternWall(open!)).toBe("2026-09-15 00:00");
  });

  it("falls back to the 7-day lead when the Tuesday anchor would not precede the deadline", () => {
    // A kickoff inside the first PICK_DEADLINE_LEAD_MINUTES of the game week puts Tuesday 00:00 ET
    // at or after the deadline, which would leave the week unpickable. No real NFL week looks like
    // this, but FR26a states the ordering as a requirement, so the code has to hold it.
    const kickoff = easternLocal(2026, 8, 15, 0, 3);
    const open = computePickWindowOpenUtc({
      weekNumber: 2,
      firstCompetitionWeek: 1,
      allSeasonGames: [{ weekNumber: 2, kickoffAt: kickoff }],
    });
    expect(easternWall(open!)).toBe("2026-09-08 00:03");
    expect(open!.getTime()).toBeLessThan(computePickDeadlineUtc(kickoff).getTime());
  });

  it("holds windowOpen < deadline < firstKickoff for every 2026 week (FR26a invariant)", () => {
    for (const { weekNumber, kickoffAt } of SEASON_2026_OPENERS) {
      const open = computePickWindowOpenUtc({
        weekNumber,
        firstCompetitionWeek: 1,
        allSeasonGames: SEASON_2026_OPENERS,
      });
      const deadline = computePickDeadlineUtc(kickoffAt);
      expect(open, `week ${weekNumber}`).not.toBeNull();
      expect(open!.getTime(), `week ${weekNumber}`).toBeLessThan(deadline.getTime());
      expect(deadline.getTime(), `week ${weekNumber}`).toBeLessThan(kickoffAt.getTime());
    }
  });
});

describe("computePicksUiIsPreview", () => {
  it("true when season not initialized", () => {
    expect(
      computePicksUiIsPreview({
        season: { preSeasonInitializedAt: null, firstCompetitionWeek: 1 },
        resolvedWeekNumber: 1,
        allSeasonGames: [{ weekNumber: 1, kickoffAt: d("2026-09-08T23:20:00.000Z") }],
        now: d("2026-09-01T12:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("true when now is before the week's window-open instant", () => {
    expect(
      computePicksUiIsPreview({
        season: {
          preSeasonInitializedAt: d("2026-05-01T00:00:00.000Z"),
          firstCompetitionWeek: 1,
        },
        resolvedWeekNumber: 1,
        allSeasonGames: [{ weekNumber: 1, kickoffAt: d("2026-09-08T23:20:00.000Z") }],
        now: d("2026-03-01T12:00:00.000Z"),
      }),
    ).toBe(true);
  });

  // Regression: preview used to end at the first competition kickoff, which is always *after* the
  // FR26 deadline — so the window opened only once it had already closed and Week 1 was silently
  // forfeited. The window must be open in the days between windowOpen and the deadline.
  //
  // Preview itself is bounded only by windowOpen; it has no deadline logic (locking after the
  // deadline is `WeekMatchupList`'s job). The deadline instant is included here purely to show the
  // whole pre-lock stretch is interactive, not to assert any coupling.
  it("false from windowOpen through the deadline instant", () => {
    const season = {
      preSeasonInitializedAt: d("2026-05-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
    };
    const games = [{ weekNumber: 1, kickoffAt: easternLocal(2026, 8, 9, 20, 15) }];
    for (const now of [
      easternLocal(2026, 8, 2, 20, 15), // exactly at windowOpen — the inclusive side of `now >= open`
      easternLocal(2026, 8, 5, 12, 0),
      easternLocal(2026, 8, 9, 20, 10), // the FR26 deadline instant
    ]) {
      expect(
        computePicksUiIsPreview({
          season,
          resolvedWeekNumber: 1,
          allSeasonGames: games,
          now,
        }),
        easternWall(now),
      ).toBe(false);
    }
  });

  it("true one millisecond before windowOpen", () => {
    const games = [{ weekNumber: 1, kickoffAt: easternLocal(2026, 8, 9, 20, 15) }];
    const windowOpen = easternLocal(2026, 8, 2, 20, 15);
    expect(
      computePicksUiIsPreview({
        season: {
          preSeasonInitializedAt: d("2026-05-01T00:00:00.000Z"),
          firstCompetitionWeek: 1,
        },
        resolvedWeekNumber: 1,
        allSeasonGames: games,
        now: new Date(windowOpen.getTime() - 1),
      }),
    ).toBe(true);
  });

  it("true for a future week even after the season has started", () => {
    // Previously any week became interactive once the first kickoff passed, so submitting on a
    // future week failed with `JAILED_NOT_COMPUTED`.
    expect(
      computePicksUiIsPreview({
        season: {
          preSeasonInitializedAt: d("2026-05-01T00:00:00.000Z"),
          firstCompetitionWeek: 1,
        },
        resolvedWeekNumber: 10,
        allSeasonGames: SEASON_2026_OPENERS,
        now: easternLocal(2026, 8, 20, 12, 0),
      }),
    ).toBe(true);
  });

  it("true for a week with no schedule data even when other weeks have games", () => {
    expect(
      computePicksUiIsPreview({
        season: {
          preSeasonInitializedAt: d("2026-05-01T00:00:00.000Z"),
          firstCompetitionWeek: 1,
        },
        resolvedWeekNumber: 19,
        allSeasonGames: SEASON_2026_OPENERS,
        now: easternLocal(2026, 11, 1, 12, 0),
      }),
    ).toBe(true);
  });

  it("true when resolvedWeekNumber < firstCompetitionWeek", () => {
    expect(
      computePicksUiIsPreview({
        season: {
          preSeasonInitializedAt: d("2026-05-01T00:00:00.000Z"),
          firstCompetitionWeek: 5,
        },
        resolvedWeekNumber: 3,
        allSeasonGames: [
          { weekNumber: 1, kickoffAt: d("2026-09-01T00:20:00.000Z") },
          { weekNumber: 3, kickoffAt: d("2026-09-10T00:20:00.000Z") },
        ],
        now: d("2026-09-09T12:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("true when no games", () => {
    expect(
      computePicksUiIsPreview({
        season: {
          preSeasonInitializedAt: d("2026-05-01T00:00:00.000Z"),
          firstCompetitionWeek: 1,
        },
        resolvedWeekNumber: 1,
        allSeasonGames: [],
        now: d("2026-09-01T12:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("test league: false when pre-season initialized even if now is far before real kickoff (AC6)", () => {
    expect(
      computePicksUiIsPreview({
        season: {
          preSeasonInitializedAt: d("2026-05-01T00:00:00.000Z"),
          firstCompetitionWeek: 1,
        },
        resolvedWeekNumber: 1,
        allSeasonGames: [{ weekNumber: 1, kickoffAt: d("2026-09-08T23:20:00.000Z") }],
        now: d("2026-03-01T12:00:00.000Z"),
        isTestLeague: true,
      }),
    ).toBe(false);
  });

  it("test league: true when pre-season not initialized", () => {
    expect(
      computePicksUiIsPreview({
        season: { preSeasonInitializedAt: null, firstCompetitionWeek: 1 },
        resolvedWeekNumber: 1,
        allSeasonGames: [],
        now: d("2026-03-01T12:00:00.000Z"),
        isTestLeague: true,
      }),
    ).toBe(true);
  });

  it("production (isTestLeague false): omitting the flag matches passing it explicitly", () => {
    const args = {
      season: {
        preSeasonInitializedAt: d("2026-05-01T00:00:00.000Z"),
        firstCompetitionWeek: 1,
      },
      resolvedWeekNumber: 1,
      allSeasonGames: [{ weekNumber: 1, kickoffAt: d("2026-09-08T23:20:00.000Z") }],
      now: d("2026-03-01T12:00:00.000Z"),
    };
    expect(computePicksUiIsPreview({ ...args, isTestLeague: false })).toBe(true);
    expect(computePicksUiIsPreview(args)).toBe(true);
  });
});

describe("resolveActiveWeekNumber", () => {
  it("test league with simulatedCurrentWeek returns the simulation pointer", () => {
    const season: MinimalSeasonForPicksWeek = {
      preSeasonInitializedAt: d("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: 3,
    };
    const games: MinimalNflGameForPicksWeek[] = [
      { weekNumber: 1, kickoffAt: d("2026-09-04T00:20:00.000Z") },
      { weekNumber: 2, kickoffAt: d("2026-09-11T00:20:00.000Z") },
    ];
    expect(
      resolveActiveWeekNumber({
        isTestLeague: true,
        season,
        gamesForYear: games,
        now: d("2026-09-05T12:00:00.000Z"),
      }),
    ).toBe(3);
  });

  it("production path is byte-identical to resolvePicksWeekNumber (AC8)", () => {
    const season: MinimalSeasonForPicksWeek = {
      preSeasonInitializedAt: d("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: 99,
    };
    const games: MinimalNflGameForPicksWeek[] = [
      { weekNumber: 1, kickoffAt: d("2026-09-04T00:20:00.000Z") },
      { weekNumber: 2, kickoffAt: d("2026-09-11T00:20:00.000Z") },
    ];
    const now = d("2026-09-05T12:00:00.000Z");
    expect(
      resolveActiveWeekNumber({ isTestLeague: false, season, gamesForYear: games, now }),
    ).toBe(resolvePicksWeekNumber(season, games, now));
  });

  it("test league without simulatedCurrentWeek falls through to resolvePicksWeekNumber", () => {
    const season: MinimalSeasonForPicksWeek = {
      preSeasonInitializedAt: d("2026-08-01T00:00:00.000Z"),
      firstCompetitionWeek: 1,
      simulatedCurrentWeek: null,
    };
    const games: MinimalNflGameForPicksWeek[] = [
      { weekNumber: 1, kickoffAt: d("2026-09-04T00:20:00.000Z") },
      { weekNumber: 2, kickoffAt: d("2026-09-11T00:20:00.000Z") },
    ];
    const now = d("2026-09-05T12:00:00.000Z");
    expect(
      resolveActiveWeekNumber({ isTestLeague: true, season, gamesForYear: games, now }),
    ).toBe(resolvePicksWeekNumber(season, games, now));
  });
});
