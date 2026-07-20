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

  it("defaults isTestLeague to false", () => {
    const r = createLeagueBodySchema.safeParse({ name: "L" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.isTestLeague).toBe(false);
    }
  });

  it("accepts explicit isTestLeague true and false", () => {
    expect(createLeagueBodySchema.safeParse({ name: "L", isTestLeague: true }).success).toBe(true);
    expect(createLeagueBodySchema.safeParse({ name: "L", isTestLeague: false }).success).toBe(true);
    const r = createLeagueBodySchema.safeParse({ name: "L", isTestLeague: true });
    if (r.success) {
      expect(r.data.isTestLeague).toBe(true);
    }
  });

  it("rejects non-boolean isTestLeague", () => {
    expect(createLeagueBodySchema.safeParse({ name: "L", isTestLeague: "true" }).success).toBe(
      false,
    );
    expect(createLeagueBodySchema.safeParse({ name: "L", isTestLeague: 1 }).success).toBe(false);
  });

  it("defaults simulationWeekCount to 4", () => {
    const r = createLeagueBodySchema.safeParse({ name: "L" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.simulationWeekCount).toBe(4);
    }
  });

  it("accepts simulationWeekCount 1–18 and coerces numeric strings", () => {
    const r = createLeagueBodySchema.safeParse({
      name: "L",
      isTestLeague: true,
      simulationWeekCount: "6",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.simulationWeekCount).toBe(6);
    }
  });

  it("rejects simulationWeekCount outside 1–18", () => {
    expect(
      createLeagueBodySchema.safeParse({ name: "L", simulationWeekCount: 0 }).success,
    ).toBe(false);
    expect(
      createLeagueBodySchema.safeParse({ name: "L", simulationWeekCount: 19 }).success,
    ).toBe(false);
  });

  it("rejects test-league sim that would run past Week 18", () => {
    const r = createLeagueBodySchema.safeParse({
      name: "L",
      isTestLeague: true,
      firstCompetitionWeek: 16,
      simulationWeekCount: 4,
    });
    expect(r.success).toBe(false);
  });

  it("does not apply sim bound refine when isTestLeague is false", () => {
    const r = createLeagueBodySchema.safeParse({
      name: "L",
      isTestLeague: false,
      firstCompetitionWeek: 16,
      simulationWeekCount: 4,
    });
    expect(r.success).toBe(true);
  });
});
