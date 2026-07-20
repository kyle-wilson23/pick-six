import { describe, expect, it } from "vitest";

import {
  finalSimulationWeek,
  isSimulationComplete,
  isSimulationWeekCountValid,
  nextSimulationWeek,
} from "./simulation-week";

describe("finalSimulationWeek", () => {
  it("returns firstCompetitionWeek when count is 1", () => {
    expect(finalSimulationWeek(5, 1)).toBe(5);
  });

  it("returns inclusive end week for multi-week sims", () => {
    expect(finalSimulationWeek(1, 4)).toBe(4);
    expect(finalSimulationWeek(15, 4)).toBe(18);
  });
});

describe("isSimulationWeekCountValid", () => {
  it("accepts valid bound combos", () => {
    expect(isSimulationWeekCountValid(1, 4)).toBe(true);
    expect(isSimulationWeekCountValid(1, 18)).toBe(true);
    expect(isSimulationWeekCountValid(15, 4)).toBe(true);
    expect(isSimulationWeekCountValid(18, 1)).toBe(true);
  });

  it("rejects combos that run past Week 18", () => {
    expect(isSimulationWeekCountValid(16, 4)).toBe(false);
    expect(isSimulationWeekCountValid(18, 2)).toBe(false);
  });

  it("rejects out-of-range count", () => {
    expect(isSimulationWeekCountValid(1, 0)).toBe(false);
    expect(isSimulationWeekCountValid(1, 19)).toBe(false);
  });
});

describe("isSimulationComplete", () => {
  it("true only at the final configured week", () => {
    expect(
      isSimulationComplete({
        firstCompetitionWeek: 1,
        simulationWeekCount: 4,
        simulatedCurrentWeek: 4,
      }),
    ).toBe(true);
    expect(
      isSimulationComplete({
        firstCompetitionWeek: 1,
        simulationWeekCount: 4,
        simulatedCurrentWeek: 3,
      }),
    ).toBe(false);
  });
});

describe("nextSimulationWeek", () => {
  it("returns null when not started", () => {
    expect(
      nextSimulationWeek({
        firstCompetitionWeek: 1,
        simulationWeekCount: 4,
        simulatedCurrentWeek: null,
      }),
    ).toBeNull();
  });

  it("returns null when not configured", () => {
    expect(
      nextSimulationWeek({
        firstCompetitionWeek: 1,
        simulationWeekCount: null,
        simulatedCurrentWeek: 1,
      }),
    ).toBeNull();
  });

  it("returns next week mid-simulation", () => {
    expect(
      nextSimulationWeek({
        firstCompetitionWeek: 1,
        simulationWeekCount: 4,
        simulatedCurrentWeek: 2,
      }),
    ).toBe(3);
  });

  it("returns null at final week", () => {
    expect(
      nextSimulationWeek({
        firstCompetitionWeek: 1,
        simulationWeekCount: 4,
        simulatedCurrentWeek: 4,
      }),
    ).toBeNull();
  });
});
