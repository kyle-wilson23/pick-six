import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { isInternalAppNavigationHref } from "./NavigationLoadingIndicator";

describe("isInternalAppNavigationHref", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { location: { origin: "https://app.example.com" } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true for same-origin path changes", () => {
    expect(isInternalAppNavigationHref("/my-leagues", "/home", "")).toBe(true);
  });

  it("returns true for same-origin query changes", () => {
    expect(
      isInternalAppNavigationHref(
        "/leagues/abc/picks?weekNumber=2",
        "/leagues/abc/picks",
        "?weekNumber=1",
      ),
    ).toBe(true);
  });

  it("returns false for the current URL", () => {
    expect(isInternalAppNavigationHref("/home", "/home", "")).toBe(false);
  });

  it("returns false for external URLs", () => {
    expect(isInternalAppNavigationHref("https://evil.com/x", "/home", "")).toBe(false);
  });
});
