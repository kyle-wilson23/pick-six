import { describe, expect, it } from "vitest";

import { patchFirstCompetitionWeekBodySchema } from "./patch-first-competition-week-body";

describe("patchFirstCompetitionWeekBodySchema", () => {
  it("accepts 1–18 and coerces numeric strings", () => {
    expect(patchFirstCompetitionWeekBodySchema.safeParse({ firstCompetitionWeek: 1 }).success).toBe(true);
    expect(patchFirstCompetitionWeekBodySchema.safeParse({ firstCompetitionWeek: "18" }).success).toBe(true);
    expect(
      patchFirstCompetitionWeekBodySchema.safeParse({ firstCompetitionWeek: "18" }).data?.firstCompetitionWeek,
    ).toBe(18);
  });

  it("rejects out of range and extra keys", () => {
    expect(patchFirstCompetitionWeekBodySchema.safeParse({ firstCompetitionWeek: 0 }).success).toBe(false);
    expect(patchFirstCompetitionWeekBodySchema.safeParse({ firstCompetitionWeek: 19 }).success).toBe(false);
    expect(patchFirstCompetitionWeekBodySchema.safeParse({ firstCompetitionWeek: 1, extra: 1 }).success).toBe(
      false,
    );
  });
});
