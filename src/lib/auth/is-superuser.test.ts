import { describe, expect, it } from "vitest";

import { configuredSuperuserEmail, isSuperuserEmail } from "./is-superuser";

describe("configuredSuperuserEmail", () => {
  it("returns null when unset, empty, or whitespace", () => {
    expect(configuredSuperuserEmail({})).toBeNull();
    expect(configuredSuperuserEmail({ SUPERUSER_EMAIL: "" })).toBeNull();
    expect(configuredSuperuserEmail({ SUPERUSER_EMAIL: "   " })).toBeNull();
  });

  it("normalizes the configured address", () => {
    expect(configuredSuperuserEmail({ SUPERUSER_EMAIL: " Kyle@X.com " })).toBe("kyle@x.com");
  });
});

describe("isSuperuserEmail", () => {
  const env = { SUPERUSER_EMAIL: "Kyle@X.com " };

  it("matches case and whitespace", () => {
    expect(isSuperuserEmail("kyle@x.com", env)).toBe(true);
    expect(isSuperuserEmail("KYLE@X.COM", env)).toBe(true);
  });

  it("returns false for other emails and missing input", () => {
    expect(isSuperuserEmail("other@x.com", env)).toBe(false);
    expect(isSuperuserEmail(null, env)).toBe(false);
    expect(isSuperuserEmail(undefined, env)).toBe(false);
    expect(isSuperuserEmail("", env)).toBe(false);
  });

  it("returns false when env is unset", () => {
    expect(isSuperuserEmail("kyle@x.com", {})).toBe(false);
  });
});
