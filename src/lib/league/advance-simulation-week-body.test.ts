import { describe, expect, it } from "vitest";

import { advanceSimulationWeekBodySchema } from "./advance-simulation-week-body";

describe("advanceSimulationWeekBodySchema", () => {
  it("accepts fromWeek in 1–18 and coerces numeric strings", () => {
    const r = advanceSimulationWeekBodySchema.safeParse({ fromWeek: "3" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.fromWeek).toBe(3);
    }
  });

  it("rejects week 0 and week 19", () => {
    expect(advanceSimulationWeekBodySchema.safeParse({ fromWeek: 0 }).success).toBe(false);
    expect(advanceSimulationWeekBodySchema.safeParse({ fromWeek: 19 }).success).toBe(false);
  });

  it("rejects missing fromWeek and extra keys", () => {
    expect(advanceSimulationWeekBodySchema.safeParse({}).success).toBe(false);
    expect(
      advanceSimulationWeekBodySchema.safeParse({ fromWeek: 1, extra: true }).success,
    ).toBe(false);
  });
});
