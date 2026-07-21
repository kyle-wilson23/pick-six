import { describe, expect, it } from "vitest";

import { deriveFixtureGameResult } from "@/lib/domain/derive-fixture-game-result";
import { getGameWinner, scorePickOutcome } from "@/lib/domain/scoring";

describe("deriveFixtureGameResult", () => {
  const base = {
    nflSeasonYear: 2026,
    weekNumber: 1,
    homeTeamId: "team-home-phi",
    awayTeamId: "team-away-dal",
  };

  it("is deterministic for the same inputs", () => {
    const a = deriveFixtureGameResult(base);
    const b = deriveFixtureGameResult(base);
    expect(a).toEqual(b);
  });

  it("produces different results for different team pairs or weeks", () => {
    const a = deriveFixtureGameResult(base);
    const b = deriveFixtureGameResult({
      ...base,
      homeTeamId: "team-home-kc",
      awayTeamId: "team-away-buf",
    });
    const c = deriveFixtureGameResult({ ...base, weekNumber: 2 });
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("keeps both scores in [3, 45] and never ties across many samples", () => {
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
        const result = deriveFixtureGameResult({
          nflSeasonYear: 2026,
          weekNumber: week,
          homeTeamId: home,
          awayTeamId: away,
        });
        expect(result.homeScore).toBeGreaterThanOrEqual(3);
        expect(result.homeScore).toBeLessThanOrEqual(45);
        expect(result.awayScore).toBeGreaterThanOrEqual(3);
        expect(result.awayScore).toBeLessThanOrEqual(45);
        expect(Number.isInteger(result.homeScore)).toBe(true);
        expect(Number.isInteger(result.awayScore)).toBe(true);
        expect(result.homeScore).not.toBe(result.awayScore);
      }
    }
  });

  it("applies the fixed-margin bump when the independently-derived scores collide, bumping home up", () => {
    // Found by brute-force search: raw (pre-bump) home/away hashes both land on 24 for this pair,
    // with the tie-break hash byte selecting "bump home". Exercises the collision branch directly
    // rather than relying on chance within a small sample (see AC1's never-tie guarantee).
    const result = deriveFixtureGameResult({
      nflSeasonYear: 2026,
      weekNumber: 1,
      homeTeamId: "collision-home-34",
      awayTeamId: "collision-away-34",
    });
    expect(result).toEqual({ homeScore: 31, awayScore: 24 });
    expect(result.homeScore).not.toBe(result.awayScore);
  });

  it("applies the fixed-margin bump when the independently-derived scores collide, bumping away down", () => {
    // Found by brute-force search: raw (pre-bump) home/away hashes both land on 43 for this pair,
    // with the tie-break hash byte selecting "bump away"; 43 + margin exceeds SCORE_MAX so the
    // bump direction flips downward. Exercises the "bump would overflow" branch directly.
    const result = deriveFixtureGameResult({
      nflSeasonYear: 2026,
      weekNumber: 1,
      homeTeamId: "collision-home-226",
      awayTeamId: "collision-away-226",
    });
    expect(result).toEqual({ homeScore: 43, awayScore: 36 });
    expect(result.homeScore).not.toBe(result.awayScore);
  });

  it("pipes into getGameWinner + scorePickOutcome as a non-tie win (AC1)", () => {
    const samples = [
      { home: "phi", away: "dal" },
      { home: "kc", away: "buf" },
      { home: "sf", away: "sea" },
      { home: "gb", away: "min" },
      { home: "bal", away: "pit" },
      { home: "mia", away: "nyj" },
      { home: "det", away: "chi" },
      { home: "cin", away: "cle" },
    ];

    for (const [i, g] of samples.entries()) {
      const homeTeamId = `home-${g.home}`;
      const awayTeamId = `away-${g.away}`;
      const scores = deriveFixtureGameResult({
        nflSeasonYear: 2026,
        weekNumber: 1 + (i % 4),
        homeTeamId,
        awayTeamId,
      });

      const winner = getGameWinner({
        homeTeamId,
        awayTeamId,
        homeScore: scores.homeScore,
        awayScore: scores.awayScore,
      });
      expect(winner.kind).toBe("win");
      if (winner.kind !== "win") continue;

      const scored = scorePickOutcome(
        { teamId: winner.winnerId, antiJailedBonus: false },
        winner,
      );
      expect(scored.outcome).toBe("WIN");
      expect(scored.pointsEarned).toBe(1);
    }
  });
});
