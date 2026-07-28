import { describe, expect, it } from "vitest";

import { getTestLeagueEmailMode } from "./test-league-email-mode";

describe("getTestLeagueEmailMode", () => {
  it("defaults to send when unset", () => {
    expect(getTestLeagueEmailMode({})).toBe("send");
  });

  it("defaults to send when empty or garbage", () => {
    expect(getTestLeagueEmailMode({ TEST_LEAGUE_EMAIL_MODE: "" })).toBe("send");
    expect(getTestLeagueEmailMode({ TEST_LEAGUE_EMAIL_MODE: "   " })).toBe("send");
    expect(getTestLeagueEmailMode({ TEST_LEAGUE_EMAIL_MODE: "redirect" })).toBe("send");
  });

  it("returns suppress only on exact match (trimmed, case-insensitive)", () => {
    expect(getTestLeagueEmailMode({ TEST_LEAGUE_EMAIL_MODE: "suppress" })).toBe("suppress");
    expect(getTestLeagueEmailMode({ TEST_LEAGUE_EMAIL_MODE: "SUPPRESS" })).toBe("suppress");
    expect(getTestLeagueEmailMode({ TEST_LEAGUE_EMAIL_MODE: "  Suppress  " })).toBe("suppress");
  });
});
