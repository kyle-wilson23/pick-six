import { describe, expect, it } from "vitest";

import { teamNameForExport } from "./team-name-for-export";

describe("teamNameForExport", () => {
  it("maps known abbreviations to legacy labels", () => {
    expect(teamNameForExport("DEN", "Denver Broncos")).toBe("Broncos");
    expect(teamNameForExport("TB", "Tampa Bay Buccaneers")).toBe("Bucs");
    expect(teamNameForExport("WAS", "Washington Commanders")).toBe("Commanders");
    expect(teamNameForExport("SF", "San Francisco 49ers")).toBe("49ers");
  });

  it("falls back to the last word of fullName for unmapped abbreviations", () => {
    expect(teamNameForExport("XYZ", "Example City Widgets")).toBe("Widgets");
  });
});
