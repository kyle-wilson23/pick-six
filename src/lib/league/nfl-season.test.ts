import { afterEach, describe, expect, it, vi } from "vitest";

import { getCurrentNflSeasonYear } from "./nfl-season";

describe("getCurrentNflSeasonYear", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns NFL_SEASON_YEAR when valid", () => {
    vi.stubEnv("NFL_SEASON_YEAR", "2031");
    expect(getCurrentNflSeasonYear(new Date("2026-06-01T00:00:00.000Z"))).toBe(2031);
  });

  it("ignores invalid env and falls back to UTC year of `now`", () => {
    vi.stubEnv("NFL_SEASON_YEAR", "nope");
    expect(getCurrentNflSeasonYear(new Date("2026-06-01T00:00:00.000Z"))).toBe(2026);
  });

  it("ignores out-of-range env", () => {
    vi.stubEnv("NFL_SEASON_YEAR", "1999");
    expect(getCurrentNflSeasonYear(new Date("2026-06-01T00:00:00.000Z"))).toBe(2026);
  });
});
