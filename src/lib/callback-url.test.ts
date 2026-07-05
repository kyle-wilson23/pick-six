import { describe, expect, it } from "vitest";

import { buildLoginRedirectWithCallback, getSafeCallbackPath } from "./callback-url";

describe("getSafeCallbackPath", () => {
  it("defaults when empty or null", () => {
    expect(getSafeCallbackPath(null)).toBe("/");
    expect(getSafeCallbackPath(undefined)).toBe("/");
    expect(getSafeCallbackPath("")).toBe("/");
    expect(getSafeCallbackPath("   ")).toBe("/");
  });

  it("allows path-only same-app paths", () => {
    expect(getSafeCallbackPath("/dashboard")).toBe("/dashboard");
    expect(getSafeCallbackPath("/dashboard/settings")).toBe("/dashboard/settings");
    expect(getSafeCallbackPath("/dashboard?tab=1")).toBe("/dashboard?tab=1");
  });

  it("rejects protocol-relative and non-path values", () => {
    expect(getSafeCallbackPath("//evil.com/x", { defaultPath: "/" })).toBe("/");
    expect(getSafeCallbackPath("https://evil.com", { defaultPath: "/" })).toBe("/");
    expect(getSafeCallbackPath("not-a-path", { defaultPath: "/" })).toBe("/");
  });

  it("allows same-origin absolute URLs when sameOrigin is set", () => {
    expect(
      getSafeCallbackPath("https://app.example.com/dashboard", {
        defaultPath: "/",
        sameOrigin: "https://app.example.com",
      }),
    ).toBe("/dashboard");
  });

  it("rejects other origins when sameOrigin is set", () => {
    expect(
      getSafeCallbackPath("https://evil.com/ok", {
        defaultPath: "/home",
        sameOrigin: "https://app.example.com",
      }),
    ).toBe("/home");
  });

  it("rejects external absolute URLs when sameOrigin is omitted", () => {
    expect(getSafeCallbackPath("https://app.example.com/x")).toBe("/");
  });

  it("uses /login → default to avoid redirect loops", () => {
    expect(getSafeCallbackPath("/login", { defaultPath: "/dash" })).toBe("/dash");
    expect(getSafeCallbackPath("/login/reset", { defaultPath: "/dash" })).toBe("/dash");
  });

  it("accepts league picks paths as valid server-side path-only callbackUrls", () => {
    expect(getSafeCallbackPath("/leagues/clxxxxxxxx/picks")).toBe("/leagues/clxxxxxxxx/picks");
    expect(getSafeCallbackPath("/leagues/clxxxxxxxx/picks?weekNumber=5")).toBe(
      "/leagues/clxxxxxxxx/picks?weekNumber=5",
    );
  });

  it("buildLoginRedirectWithCallback encodes a safe path", () => {
    expect(buildLoginRedirectWithCallback("/dashboard/foo")).toBe(
      "/login?callbackUrl=%2Fdashboard%2Ffoo",
    );
  });
});
