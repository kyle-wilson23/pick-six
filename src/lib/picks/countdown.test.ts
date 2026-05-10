import { describe, expect, it } from "vitest";

import {
  FORTY_EIGHT_HOURS_MS,
  FOUR_HOURS_MS,
  getCountdownVariant,
  isPickWindowClosedByDeadline,
} from "./countdown";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("getCountdownVariant — urgency bands", () => {
  it("calm when > 48h remaining", () => {
    expect(getCountdownVariant(3 * DAY).urgency).toBe("calm");
    expect(getCountdownVariant(FORTY_EIGHT_HOURS_MS + MINUTE).urgency).toBe("calm");
  });

  it("elevated at exactly 48h and within 24h–48h", () => {
    expect(getCountdownVariant(FORTY_EIGHT_HOURS_MS).urgency).toBe("elevated");
    expect(getCountdownVariant(36 * HOUR).urgency).toBe("elevated");
    expect(getCountdownVariant(24 * HOUR).urgency).toBe("elevated");
  });

  it("elevated below 24h down to 4h", () => {
    expect(getCountdownVariant(12 * HOUR).urgency).toBe("elevated");
    expect(getCountdownVariant(FOUR_HOURS_MS).urgency).toBe("elevated");
  });

  it("critical when < 4h remaining (and > 0)", () => {
    expect(getCountdownVariant(FOUR_HOURS_MS - MINUTE).urgency).toBe("critical");
    expect(getCountdownVariant(30 * MINUTE).urgency).toBe("critical");
    expect(getCountdownVariant(1).urgency).toBe("critical");
  });

  it("passed at zero / negative", () => {
    expect(getCountdownVariant(0)).toEqual({ label: "Deadline passed", urgency: "passed" });
    expect(getCountdownVariant(-5_000)).toEqual({ label: "Deadline passed", urgency: "passed" });
  });

  it("passed for non-finite input", () => {
    expect(getCountdownVariant(Number.NaN).urgency).toBe("passed");
    expect(getCountdownVariant(Number.POSITIVE_INFINITY).urgency).toBe("passed");
  });
});

describe("getCountdownVariant — label formatting", () => {
  it("formats Xd Xh Xm when > 1h", () => {
    expect(getCountdownVariant(2 * DAY + 3 * HOUR + 14 * MINUTE).label).toBe("2d 3h 14m");
  });

  it("formats 0d 1h 1m when 1h 1m remaining", () => {
    expect(getCountdownVariant(HOUR + MINUTE).label).toBe("0d 1h 1m");
  });

  it("formats Xm Xs when ≤ 1h (and > 0)", () => {
    expect(getCountdownVariant(HOUR).label).toBe("60m 0s");
    expect(getCountdownVariant(12 * MINUTE + 45 * 1000).label).toBe("12m 45s");
    expect(getCountdownVariant(45 * 1000).label).toBe("0m 45s");
  });
});

describe("isPickWindowClosedByDeadline", () => {
  const deadline = "2026-09-10T12:00:00.000Z";

  it("returns false for null deadline (preview / no schedule)", () => {
    expect(isPickWindowClosedByDeadline(null, new Date(deadline))).toBe(false);
  });

  it("returns false when now == deadline (still open per server semantics)", () => {
    expect(isPickWindowClosedByDeadline(deadline, new Date(deadline))).toBe(false);
  });

  it("returns true when now is strictly past deadline", () => {
    expect(
      isPickWindowClosedByDeadline(deadline, new Date(Date.parse(deadline) + 1)),
    ).toBe(true);
  });

  it("returns false when now is before deadline", () => {
    expect(
      isPickWindowClosedByDeadline(deadline, new Date(Date.parse(deadline) - 60_000)),
    ).toBe(false);
  });

  it("returns false for unparseable ISO string (be permissive; server is authority)", () => {
    expect(isPickWindowClosedByDeadline("not-a-date", new Date())).toBe(false);
  });
});
