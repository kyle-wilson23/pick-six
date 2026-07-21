import { describe, expect, it } from "vitest";

import { resolveJailedTeam } from "@/lib/domain/jailed";
import { deriveFixtureOddsLine } from "@/lib/domain/derive-fixture-odds-line";

describe("deriveFixtureOddsLine", () => {
  const base = {
    nflSeasonYear: 2026,
    weekNumber: 1,
    homeTeamId: "team-home-phi",
    awayTeamId: "team-away-dal",
  };

  it("is deterministic for the same inputs", () => {
    const a = deriveFixtureOddsLine(base);
    const b = deriveFixtureOddsLine(base);
    expect(a).toEqual(b);
  });

  it("produces different lines for different team pairs or weeks", () => {
    const a = deriveFixtureOddsLine(base);
    const b = deriveFixtureOddsLine({
      ...base,
      homeTeamId: "team-home-kc",
      awayTeamId: "team-away-buf",
    });
    const c = deriveFixtureOddsLine({ ...base, weekNumber: 2 });
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("never produces both non-negative moneylines (sign-safe for resolveJailedTeam)", () => {
    const pairs = [
      ["h1", "a1"],
      ["h2", "a2"],
      ["abc", "xyz"],
      ["team-phi", "team-dal"],
      ["team-kc", "team-buf"],
      ["team-sf", "team-sea"],
      ["team-gb", "team-min"],
      ["team-bal", "team-pit"],
      ["team-mia", "team-nyj"],
      ["team-lar", "team-ari"],
      ["team-det", "team-chi"],
      ["team-cin", "team-cle"],
      ["team-hou", "team-ind"],
      ["team-den", "team-lv"],
      ["team-no", "team-tb"],
      ["team-ne", "team-nyg"],
      ["team-jax", "team-ten"],
      ["team-lac", "team-den2"],
      ["team-was", "team-phi2"],
      ["team-sea2", "team-lar2"],
    ] as const;

    for (const [home, away] of pairs) {
      for (let week = 1; week <= 6; week++) {
        const line = deriveFixtureOddsLine({
          nflSeasonYear: 2026,
          weekNumber: week,
          homeTeamId: home,
          awayTeamId: away,
        });
        const bothNonNeg =
          line.homeMoneylineAmerican >= 0 && line.awayMoneylineAmerican >= 0;
        expect(bothNonNeg).toBe(false);

        const homeFav = line.homeMoneylineAmerican < 0;
        const awayFav = line.awayMoneylineAmerican < 0;
        expect(homeFav !== awayFav).toBe(true);

        if (homeFav) {
          expect(line.homeMoneylineAmerican).toBeGreaterThanOrEqual(-450);
          expect(line.homeMoneylineAmerican).toBeLessThanOrEqual(-110);
          expect(line.awayMoneylineAmerican).toBeGreaterThanOrEqual(100);
          expect(line.awayMoneylineAmerican).toBeLessThanOrEqual(440);
          expect(line.homeSpreadPoints).toBeLessThanOrEqual(-0.5);
          expect(line.homeSpreadPoints).toBeGreaterThanOrEqual(-14);
          expect(line.homeSpreadPoints * 2).toBe(Math.round(line.homeSpreadPoints * 2));
        } else {
          expect(line.awayMoneylineAmerican).toBeGreaterThanOrEqual(-450);
          expect(line.awayMoneylineAmerican).toBeLessThanOrEqual(-110);
          expect(line.homeMoneylineAmerican).toBeGreaterThanOrEqual(100);
          expect(line.homeMoneylineAmerican).toBeLessThanOrEqual(440);
          expect(line.homeSpreadPoints).toBeGreaterThanOrEqual(0.5);
          expect(line.homeSpreadPoints).toBeLessThanOrEqual(14);
          expect(line.homeSpreadPoints * 2).toBe(Math.round(line.homeSpreadPoints * 2));
        }
      }
    }
  });

  it("feeds resolveJailedTeam without NO_COMPLETE_MONEYLINES / inconsistency (AC4)", () => {
    const games = [
      { home: "phi", away: "dal" },
      { home: "kc", away: "buf" },
      { home: "sf", away: "sea" },
      { home: "gb", away: "min" },
    ].map((g, i) => {
      const homeTeamId = `home-${g.home}`;
      const awayTeamId = `away-${g.away}`;
      const line = deriveFixtureOddsLine({
        nflSeasonYear: 2026,
        weekNumber: 1,
        homeTeamId,
        awayTeamId,
      });
      return {
        nflGameId: `game-${i}`,
        homeTeamId,
        awayTeamId,
        ...line,
      };
    });

    const resolved = resolveJailedTeam(games, "a".repeat(64));
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(["MONEYLINE", "SPREAD", "RANDOM"]).toContain(resolved.result.resolvedBy);
    }
  });
});
