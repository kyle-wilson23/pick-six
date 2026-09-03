import { describe, expect, it } from "vitest";

import { isAutomatedEmailWeekActive } from "./is-automated-email-week-active";

const d = (iso: string) => new Date(iso);

const seasonInitialized = {
  preSeasonInitializedAt: d("2026-05-01T00:00:00.000Z"),
  firstCompetitionWeek: 1,
};

const week1Games = [{ weekNumber: 1, kickoffAt: d("2026-09-08T23:20:00.000Z") }];

/** FR26a window open for `week1Games`: the first competition week opens 7 days before kickoff. */
const week1WindowOpen = d("2026-09-01T23:20:00.000Z");

describe("isAutomatedEmailWeekActive", () => {
  it("false for production league before the week's window-open instant (off-season)", () => {
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

  it("true for production league once the window has opened", () => {
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

  // The behavioural change this helper inherited from FR26a: the week is active in the stretch
  // between window open and the deadline. Under the old kickoff-gated rule every instant here was
  // inactive, so the Tuesday digest and both reminders were skipped for the week they belonged to.
  it("true between window open and the deadline, before any kickoff", () => {
    for (const now of [
      week1WindowOpen,
      d("2026-09-05T12:00:00.000Z"),
      d("2026-09-08T23:15:00.000Z"), // the FR26 deadline, five minutes before kickoff
    ]) {
      expect(
        isAutomatedEmailWeekActive({
          isTestLeague: false,
          season: seasonInitialized,
          resolvedWeekNumber: 1,
          allSeasonGames: week1Games,
          now,
        }),
        now.toISOString(),
      ).toBe(true);
    }
  });

  it("false one millisecond before window open", () => {
    expect(
      isAutomatedEmailWeekActive({
        isTestLeague: false,
        season: seasonInitialized,
        resolvedWeekNumber: 1,
        allSeasonGames: week1Games,
        now: new Date(week1WindowOpen.getTime() - 1),
      }),
    ).toBe(false);
  });

  it("false for a future week even after the season has started", () => {
    expect(
      isAutomatedEmailWeekActive({
        isTestLeague: false,
        season: seasonInitialized,
        resolvedWeekNumber: 2,
        allSeasonGames: [
          ...week1Games,
          { weekNumber: 2, kickoffAt: d("2026-09-18T00:15:00.000Z") },
        ],
        now: d("2026-09-09T12:00:00.000Z"),
      }),
    ).toBe(false);
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
