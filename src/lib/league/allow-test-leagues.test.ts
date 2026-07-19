import { afterEach, describe, expect, it, vi } from "vitest";

import { allowTestLeagues } from "./allow-test-leagues";

describe("allowTestLeagues", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows when unset", () => {
    vi.stubEnv("ALLOW_TEST_LEAGUES", undefined);
    expect(allowTestLeagues()).toBe(true);
  });

  it("allows when empty or whitespace-only", () => {
    expect(allowTestLeagues({ ALLOW_TEST_LEAGUES: "" })).toBe(true);
    expect(allowTestLeagues({ ALLOW_TEST_LEAGUES: "   " })).toBe(true);
  });

  it("allows true and 1 (case-insensitive, trimmed)", () => {
    expect(allowTestLeagues({ ALLOW_TEST_LEAGUES: "true" })).toBe(true);
    expect(allowTestLeagues({ ALLOW_TEST_LEAGUES: "TRUE" })).toBe(true);
    expect(allowTestLeagues({ ALLOW_TEST_LEAGUES: " 1 " })).toBe(true);
  });

  it("denies false and 0 (case-insensitive, trimmed)", () => {
    expect(allowTestLeagues({ ALLOW_TEST_LEAGUES: "false" })).toBe(false);
    expect(allowTestLeagues({ ALLOW_TEST_LEAGUES: "FALSE" })).toBe(false);
    expect(allowTestLeagues({ ALLOW_TEST_LEAGUES: " 0 " })).toBe(false);
  });

  it("allows unknown values (permissive default)", () => {
    expect(allowTestLeagues({ ALLOW_TEST_LEAGUES: "maybe" })).toBe(true);
  });
});
