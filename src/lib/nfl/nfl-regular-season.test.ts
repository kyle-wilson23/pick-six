import { describe, expect, it } from "vitest";

import {
  assertNflRegularSeasonWeek,
  isNflRegularSeasonWeek,
  isWeekInLeagueCompetition,
  NFL_REGULAR_SEASON_WEEK_MAX,
  NFL_REGULAR_SEASON_WEEK_MIN,
} from "./nfl-regular-season";

describe("isNflRegularSeasonWeek", () => {
  it("accepts 1 and 18", () => {
    expect(isNflRegularSeasonWeek(1)).toBe(true);
    expect(isNflRegularSeasonWeek(18)).toBe(true);
  });

  it("rejects out-of-range and non-integers", () => {
    expect(isNflRegularSeasonWeek(0)).toBe(false);
    expect(isNflRegularSeasonWeek(19)).toBe(false);
    expect(isNflRegularSeasonWeek(1.5)).toBe(false);
    expect(isNflRegularSeasonWeek(Number.NaN)).toBe(false);
  });
});

describe("assertNflRegularSeasonWeek", () => {
  it("throws for invalid weeks", () => {
    expect(() => assertNflRegularSeasonWeek(0)).toThrow(/integer between/);
  });
});

describe("isWeekInLeagueCompetition", () => {
  it("returns false for weeks before firstCompetitionWeek", () => {
    expect(isWeekInLeagueCompetition({ firstCompetitionWeek: 8 }, 7)).toBe(false);
  });

  it("returns true from firstCompetitionWeek through week 18", () => {
    expect(isWeekInLeagueCompetition({ firstCompetitionWeek: 8 }, 8)).toBe(true);
    expect(isWeekInLeagueCompetition({ firstCompetitionWeek: 8 }, 18)).toBe(true);
  });

  it("treats week 1 as in competition when firstCompetitionWeek is 1", () => {
    expect(isWeekInLeagueCompetition({ firstCompetitionWeek: 1 }, 1)).toBe(true);
  });

  it("returns false for invalid NFL week numbers", () => {
    expect(isWeekInLeagueCompetition({ firstCompetitionWeek: 1 }, 0)).toBe(false);
  });
});

describe("constants", () => {
  it("keeps 1..18 bounds", () => {
    expect(NFL_REGULAR_SEASON_WEEK_MIN).toBe(1);
    expect(NFL_REGULAR_SEASON_WEEK_MAX).toBe(18);
  });
});
