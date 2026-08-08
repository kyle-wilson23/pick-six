import { describe, expect, it } from "vitest";

import { isAutomatedEmailWeekActive } from "./is-automated-email-week-active";

const d = (iso: string) => new Date(iso);

const seasonInitialized = {
  preSeasonInitializedAt: d("2026-05-01T00:00:00.000Z"),
  firstCompetitionWeek: 1,
};

const week1Games = [{ weekNumber: 1, kickoffAt: d("2026-09-08T23:20:00.000Z") }];

describe("isAutomatedEmailWeekActive", () => {
  it("false for production league before first competition kickoff (off-season)", () => {
    expect(
      isAutomatedEmailWeekActive({
        isTestLeague: false,
        season: seasonInitialized,
        resolvedWeekNumber: 1,
        allSeasonGames: week1Games,
        now: d("2026-08-08T12:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("true for production league after first competition kickoff", () => {
    expect(
      isAutomatedEmailWeekActive({
        isTestLeague: false,
        season: seasonInitialized,
        resolvedWeekNumber: 1,
        allSeasonGames: week1Games,
        now: d("2026-09-09T12:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("true for test leagues even before real NFL kickoff", () => {
    expect(
      isAutomatedEmailWeekActive({
        isTestLeague: true,
        season: seasonInitialized,
        resolvedWeekNumber: 1,
        allSeasonGames: week1Games,
        now: d("2026-08-08T12:00:00.000Z"),
      }),
    ).toBe(true);
  });
});
