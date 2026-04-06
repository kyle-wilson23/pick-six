import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SESSION_MAX_AGE_SECONDS,
  getSessionMaxAgeSeconds,
} from "./session-constants";

const authTsPath = join(dirname(fileURLToPath(import.meta.url)), "auth.ts");

describe("getSessionMaxAgeSeconds", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the production cap when NODE_ENV is not development", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_MAX_AGE_DEV_SECONDS", "120");
    expect(getSessionMaxAgeSeconds()).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("returns the production cap in development when SESSION_MAX_AGE_DEV_SECONDS is unset", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_MAX_AGE_DEV_SECONDS", "");
    expect(getSessionMaxAgeSeconds()).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("uses a positive dev override in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_MAX_AGE_DEV_SECONDS", "120");
    expect(getSessionMaxAgeSeconds()).toBe(120);
  });

  it("floors a fractional dev override", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_MAX_AGE_DEV_SECONDS", "99.7");
    expect(getSessionMaxAgeSeconds()).toBe(99);
  });

  it("ignores invalid dev overrides", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_MAX_AGE_DEV_SECONDS", "not-a-number");
    expect(getSessionMaxAgeSeconds()).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("ignores non-positive dev overrides", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_MAX_AGE_DEV_SECONDS", "0");
    expect(getSessionMaxAgeSeconds()).toBe(SESSION_MAX_AGE_SECONDS);
  });
});

describe("auth.ts session wiring", () => {
  it("uses session-constants for maxAge and updateAge", () => {
    const authSrc = readFileSync(authTsPath, "utf8");
    expect(authSrc).toContain("getSessionMaxAgeSeconds");
    expect(authSrc).toContain("SESSION_UPDATE_AGE_SECONDS");
  });
});
