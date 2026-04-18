import { describe, expect, it } from "vitest";

import { firstCompetitionWeekLockedReason, isFirstCompetitionWeekEditable } from "./first-competition-week";

describe("isFirstCompetitionWeekEditable", () => {
  it("is true when lock timestamp is null", () => {
    expect(isFirstCompetitionWeekEditable({ firstCompetitionWeekLockedAt: null })).toBe(true);
  });

  it("is false when lock timestamp is set", () => {
    expect(
      isFirstCompetitionWeekEditable({ firstCompetitionWeekLockedAt: new Date("2026-09-10T00:00:00.000Z") }),
    ).toBe(false);
  });
});

describe("firstCompetitionWeekLockedReason", () => {
  it("returns non-empty copy", () => {
    expect(firstCompetitionWeekLockedReason().length).toBeGreaterThan(10);
  });
});
