import { describe, expect, it } from "vitest";

import { createLeagueBodySchema, LEAGUE_NAME_MAX_LENGTH } from "./create-league-body";

describe("createLeagueBodySchema", () => {
  it("accepts trimmed name and defaults firstCompetitionWeek to 1", () => {
    const r = createLeagueBodySchema.safeParse({ name: "  Office Pick'em  " });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Office Pick'em");
      expect(r.data.firstCompetitionWeek).toBe(1);
    }
  });

  it("rejects empty name after trim", () => {
    const r = createLeagueBodySchema.safeParse({ name: "   " });
    expect(r.success).toBe(false);
  });

  it("rejects name longer than LEAGUE_NAME_MAX_LENGTH", () => {
    const r = createLeagueBodySchema.safeParse({ name: "x".repeat(LEAGUE_NAME_MAX_LENGTH + 1) });
    expect(r.success).toBe(false);
  });

  it("accepts firstCompetitionWeek 18 and coerces numeric strings", () => {
    const r = createLeagueBodySchema.safeParse({ name: "L", firstCompetitionWeek: "18" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.firstCompetitionWeek).toBe(18);
    }
  });

  it("rejects week 0 and week 19", () => {
    expect(createLeagueBodySchema.safeParse({ name: "L", firstCompetitionWeek: 0 }).success).toBe(
      false,
    );
    expect(createLeagueBodySchema.safeParse({ name: "L", firstCompetitionWeek: 19 }).success).toBe(
      false,
    );
  });
});
