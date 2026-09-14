import { describe, expect, it } from "vitest";

import { resolveWeekCloseTargets } from "./week-close-targets";

const d = (iso: string) => new Date(iso);

describe("resolveWeekCloseTargets", () => {
  it("week 1 still upcoming: skip finalize; snapshot + jailed week 1", () => {
    const games = [
      { weekNumber: 1, kickoffAt: d("2026-09-11T00:20:00.000Z") },
      { weekNumber: 2, kickoffAt: d("2026-09-18T00:20:00.000Z") },
    ];
    expect(resolveWeekCloseTargets(games, d("2026-09-08T11:00:00.000Z"))).toEqual({
      openingWeek: 1,
      closedWeek: null,
      snapshotWeek: 1,
    });
  });

  it("mid-season Tuesday: closed = opening − 1; snapshot opening", () => {
    const games = [
      { weekNumber: 1, kickoffAt: d("2026-09-11T00:20:00.000Z") },
      { weekNumber: 2, kickoffAt: d("2026-09-18T00:20:00.000Z") },
      { weekNumber: 3, kickoffAt: d("2026-09-25T00:20:00.000Z") },
    ];
    expect(resolveWeekCloseTargets(games, d("2026-09-15T11:00:00.000Z"))).toEqual({
      openingWeek: 2,
      closedWeek: 1,
      snapshotWeek: 2,
    });
  });

  it("post-season: finalize last week; skip snapshot", () => {
    const games = [
      { weekNumber: 17, kickoffAt: d("2026-12-27T18:00:00.000Z") },
      { weekNumber: 18, kickoffAt: d("2027-01-03T18:00:00.000Z") },
    ];
    expect(resolveWeekCloseTargets(games, d("2027-01-10T12:00:00.000Z"))).toEqual({
      openingWeek: 18,
      closedWeek: 18,
      snapshotWeek: null,
    });
  });

  it("empty slate: skip finalize; snapshot week 1", () => {
    expect(resolveWeekCloseTargets([], d("2026-09-08T11:00:00.000Z"))).toEqual({
      openingWeek: 1,
      closedWeek: null,
      snapshotWeek: 1,
    });
  });
});
