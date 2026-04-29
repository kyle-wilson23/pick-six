import { describe, expect, it } from "vitest";

import {
  computePicksUiIsPreview,
  resolvePicksWeekNumber,
  type MinimalNflGameForPicksWeek,
  type MinimalSeasonForPicksWeek,
} from "./resolve-picks-week";

const d = (iso: string) => new Date(iso);

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

  it("true when now is before earliest competition-window kickoff", () => {
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

  it("false when in-window after earliest competition kickoff", () => {
    expect(
      computePicksUiIsPreview({
        season: {
          preSeasonInitializedAt: d("2026-05-01T00:00:00.000Z"),
          firstCompetitionWeek: 1,
        },
        resolvedWeekNumber: 1,
        allSeasonGames: [{ weekNumber: 1, kickoffAt: d("2026-09-08T23:20:00.000Z") }],
        now: d("2026-09-09T12:00:00.000Z"),
      }),
    ).toBe(false);
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
});
