import { describe, expect, it } from "vitest";

import {
  getEasternWallClock,
  isInEasternWindow,
} from "./eastern-window";

describe("isInEasternWindow", () => {
  it("returns true for Tuesday 6 PM ET inside Tue 17–21 window", () => {
    // Tue Jul 7 2026 6 PM EDT = Tue 22:00 UTC
    const now = new Date("2026-07-07T22:00:00.000Z");
    expect(isInEasternWindow(now, 2, 17, 21)).toBe(true);
    expect(getEasternWallClock(now)).toMatchObject({ dayOfWeek: 2, hour: 18 });
  });

  it("returns false for Tuesday 4 PM ET outside window", () => {
    // Tue Jul 7 2026 4 PM EDT = Tue 20:00 UTC
    const now = new Date("2026-07-07T20:00:00.000Z");
    expect(isInEasternWindow(now, 2, 17, 21)).toBe(false);
    expect(getEasternWallClock(now)).toMatchObject({ dayOfWeek: 2, hour: 16 });
  });

  it("returns true for Wednesday inside Wed 19–24 window", () => {
    // Wed Jul 8 2026 8 PM EDT = Thu 00:00 UTC
    const now = new Date("2026-07-09T00:00:00.000Z");
    expect(isInEasternWindow(now, 3, 19, 24)).toBe(true);
    expect(getEasternWallClock(now)).toMatchObject({ dayOfWeek: 3, hour: 20 });
  });

  it("handles DST fallback week in early November (EST, UTC-5)", () => {
    // Wed Nov 4 2026 7 PM EST (after Nov 1 DST end) = Thu 00:00 UTC
    const now = new Date("2026-11-05T00:00:00.000Z");
    expect(getEasternWallClock(now)).toMatchObject({ dayOfWeek: 3, hour: 19 });
    expect(isInEasternWindow(now, 3, 19, 24)).toBe(true);

    // Tue Nov 3 2026 6 PM EST = Wed 23:00 UTC
    const tuesdayEvening = new Date("2026-11-04T00:00:00.000Z");
    expect(getEasternWallClock(tuesdayEvening)).toMatchObject({ dayOfWeek: 2, hour: 19 });
    expect(isInEasternWindow(tuesdayEvening, 2, 17, 21)).toBe(true);
  });
});
