import { describe, expect, it } from "vitest";

import nflTeams from "../../../prisma/data/nfl-teams.json";

import { resolveNflLogoSrc } from "./resolve-nfl-logo-src";

describe("resolveNflLogoSrc", () => {
  it("trims whitespace", () => {
    expect(resolveNflLogoSrc({ abbreviation: "  buf  " })).toBe("/nfl-logos/BUF.png");
  });

  it("normalizes casing", () => {
    expect(resolveNflLogoSrc({ abbreviation: "gb" })).toBe("/nfl-logos/GB.png");
    expect(resolveNflLogoSrc({ abbreviation: "lAr" })).toBe("/nfl-logos/LAR.png");
  });

  it("returns null for unknown abbreviations", () => {
    expect(resolveNflLogoSrc({ abbreviation: "ZZZ" })).toBeNull();
    expect(resolveNflLogoSrc({ abbreviation: "NFL" })).toBeNull();
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(resolveNflLogoSrc({ abbreviation: "" })).toBeNull();
    expect(resolveNflLogoSrc({ abbreviation: "   " })).toBeNull();
  });

  it("resolves all seeded NFL teams", () => {
    expect(nflTeams.length).toBe(32);
    for (const team of nflTeams) {
      const upper = team.abbreviation.toUpperCase();
      expect(resolveNflLogoSrc({ abbreviation: team.abbreviation })).toBe(`/nfl-logos/${upper}.png`);
    }
  });
});
