import { describe, expect, it } from "vitest";

import {
  checkLeagueDeleteRateLimit,
  checkSignInRateLimit,
} from "@/lib/rate-limit";

describe("checkLeagueDeleteRateLimit", () => {
  it("allows 5 requests per client key then blocks within the window", () => {
    const key = `league-del-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkLeagueDeleteRateLimit(key)).toBe(true);
    }
    expect(checkLeagueDeleteRateLimit(key)).toBe(false);
  });

  it("does not share bucket with sign-in namespace", () => {
    const key = `shared-${Math.random()}`;
    for (let i = 0; i < 10; i++) {
      expect(checkSignInRateLimit(key)).toBe(true);
    }
    expect(checkLeagueDeleteRateLimit(key)).toBe(true);
  });
});
