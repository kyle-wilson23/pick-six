import { describe, expect, it } from "vitest";

import {
  checkLeagueDeleteRateLimit,
  checkPasswordResetRateLimit,
  checkRegisterRateLimit,
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

describe("checkPasswordResetRateLimit", () => {
  it("allows 8 requests per client key then blocks within the window", () => {
    const key = `password-reset-${Math.random()}`;
    for (let i = 0; i < 8; i++) {
      expect(checkPasswordResetRateLimit(key)).toBe(true);
    }
    expect(checkPasswordResetRateLimit(key)).toBe(false);
  });

  it("does not share bucket with sign-in namespace", () => {
    const key = `shared-reset-${Math.random()}`;
    for (let i = 0; i < 8; i++) {
      expect(checkPasswordResetRateLimit(key)).toBe(true);
    }
    expect(checkSignInRateLimit(key)).toBe(true);
  });
});

describe("checkRegisterRateLimit", () => {
  it("allows 6 requests per client key then blocks within the window", () => {
    const key = `register-${Math.random()}`;
    for (let i = 0; i < 6; i++) {
      expect(checkRegisterRateLimit(key)).toBe(true);
    }
    expect(checkRegisterRateLimit(key)).toBe(false);
  });

  it("does not share bucket with sign-in namespace", () => {
    const key = `shared-register-${Math.random()}`;
    for (let i = 0; i < 6; i++) {
      expect(checkRegisterRateLimit(key)).toBe(true);
    }
    expect(checkSignInRateLimit(key)).toBe(true);
  });
});
