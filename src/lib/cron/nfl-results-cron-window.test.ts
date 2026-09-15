import { describe, expect, it } from "vitest";

import { resolveNflResultsCronWindow } from "./nfl-results-cron-window";

describe("resolveNflResultsCronWindow", () => {
  it("is in-window and finalizes on Wednesday afternoon ET", () => {
    // Wed Sep 16 2026 12:00 EDT = 16:00 UTC
    const now = new Date("2026-09-16T16:00:00.000Z");
    expect(resolveNflResultsCronWindow(now)).toEqual({
      inWindow: true,
      shouldFinalizeClosedWeek: true,
    });
  });

  it("is in-window and does not finalize on Saturday afternoon ET", () => {
    // Sat Sep 12 2026 12:00 EDT = 16:00 UTC
    const now = new Date("2026-09-12T16:00:00.000Z");
    expect(resolveNflResultsCronWindow(now)).toEqual({
      inWindow: true,
      shouldFinalizeClosedWeek: false,
    });
  });

  it("is outside the window on Tuesday morning ET", () => {
    // Tue Sep 15 2026 7:00 EDT = 11:00 UTC
    const now = new Date("2026-09-15T11:00:00.000Z");
    expect(resolveNflResultsCronWindow(now)).toEqual({
      inWindow: false,
      shouldFinalizeClosedWeek: false,
    });
  });
});
