import { describe, expect, it } from "vitest";

import { isTestLeagueLeague } from "./is-test-league";

describe("isTestLeagueLeague", () => {
  it("returns true only when isTestLeague is true", () => {
    expect(isTestLeagueLeague({ isTestLeague: true })).toBe(true);
    expect(isTestLeagueLeague({ isTestLeague: false })).toBe(false);
  });
});
