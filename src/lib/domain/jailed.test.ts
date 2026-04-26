import { describe, expect, it } from "vitest";

import {
  deterministicIndexFromSeed,
  resolveJailedTeam,
  type JailedGameInput,
} from "./jailed";

function g(overrides: Partial<JailedGameInput> & Pick<JailedGameInput, "nflGameId">): JailedGameInput {
  return {
    homeTeamId: "home",
    awayTeamId: "away",
    homeMoneylineAmerican: -110,
    awayMoneylineAmerican: 100,
    homeSpreadPoints: -1,
    ...overrides,
  };
}

const seed = "a".repeat(64);

describe("resolveJailedTeam", () => {
  it("returns NO_GAMES_FOR_WEEK when the week has no games", () => {
    const r = resolveJailedTeam([], seed);
    expect(r).toEqual(
      expect.objectContaining({
        ok: false,
        code: "NO_GAMES_FOR_WEEK",
      }),
    );
  });

  it("returns NO_COMPLETE_MONEYLINES when all games miss both moneylines or spread", () => {
    const r = resolveJailedTeam(
      [
        g({ nflGameId: "1", homeMoneylineAmerican: null, awayMoneylineAmerican: -110 }),
        g({ nflGameId: "2", homeMoneylineAmerican: -110, awayMoneylineAmerican: 100, homeSpreadPoints: null }),
      ],
      seed,
    );
    expect(r).toEqual(
      expect.objectContaining({
        ok: false,
        code: "NO_COMPLETE_MONEYLINES",
      }),
    );
  });

  it("resolves MONEYLINE when one game’s favorite is the clearest (most negative ML)", () => {
    const r = resolveJailedTeam(
      [
        g({
          nflGameId: "g1",
          homeTeamId: "tA",
          awayTeamId: "tB",
          homeMoneylineAmerican: -200,
          awayMoneylineAmerican: 170,
          homeSpreadPoints: -3,
        }),
        g({
          nflGameId: "g2",
          homeTeamId: "tC",
          awayTeamId: "tD",
          homeMoneylineAmerican: -400,
          awayMoneylineAmerican: 320,
          homeSpreadPoints: -7.5,
        }),
      ],
      seed,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      // −400 (tC) is a bigger favorite than −200 (tA); tD is the underdog in game 2, not a candidate.
      expect(r.result.jailedTeamId).toBe("tC");
      expect(r.result.resolvedBy).toBe("MONEYLINE");
      expect(r.result.randomSeed).toBeUndefined();
    }
  });

  it("uses SPREAD when two favorites tie on moneyline", () => {
    const r = resolveJailedTeam(
      [
        g({
          nflGameId: "g1",
          homeTeamId: "tA",
          awayTeamId: "tB",
          homeMoneylineAmerican: -300,
          awayMoneylineAmerican: 250,
          homeSpreadPoints: -3,
        }),
        g({
          nflGameId: "g2",
          homeTeamId: "tC",
          awayTeamId: "tD",
          homeMoneylineAmerican: -300,
          awayMoneylineAmerican: 250,
          homeSpreadPoints: -7,
        }),
      ],
      seed,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.jailedTeamId).toBe("tC");
      expect(r.result.resolvedBy).toBe("SPREAD");
    }
  });

  it("uses RANDOM with a mocked seed when moneyline and spread are fully tied", () => {
    const games: JailedGameInput[] = [
      g({
        nflGameId: "g1",
        homeTeamId: "team-aaa",
        awayTeamId: "team-zzz",
        homeMoneylineAmerican: -200,
        awayMoneylineAmerican: 170,
        homeSpreadPoints: -3.5,
      }),
      g({
        nflGameId: "g2",
        homeTeamId: "team-bbb",
        awayTeamId: "team-yyy",
        homeMoneylineAmerican: -200,
        awayMoneylineAmerican: 170,
        homeSpreadPoints: -3.5,
      }),
    ];
    const r1 = resolveJailedTeam(games, "00deadbeefcafebabe" + "0".repeat(40));
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.result.resolvedBy).toBe("RANDOM");
      expect(r1.result.randomSeed).toBe("00deadbeefcafebabe" + "0".repeat(40));
      const ids = ["team-aaa", "team-bbb"].sort();
      const idx = deterministicIndexFromSeed(r1.result.randomSeed!, 2);
      expect(r1.result.jailedTeamId).toBe(ids[idx]);
    }

    const r2 = resolveJailedTeam(games, "00deadbeefcafebabe" + "0".repeat(40));
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r2.result.jailedTeamId).toBe(r1.result.jailedTeamId);
    }
  });

  it("treats equal moneylines in one game as home favorite (tie-breaker)", () => {
    const r = resolveJailedTeam(
      [
        g({
          nflGameId: "g1",
          homeTeamId: "homeWins",
          awayTeamId: "awayLose",
          homeMoneylineAmerican: -100,
          awayMoneylineAmerican: -100,
          homeSpreadPoints: 0.5,
        }),
      ],
      seed,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.jailedTeamId).toBe("homeWins");
    }
  });

  it("returns JAILED_RESOLUTION_INCONSISTENT when a true random tie has no usable seed", () => {
    const games: JailedGameInput[] = [
      g({
        nflGameId: "g1",
        homeTeamId: "tA",
        awayTeamId: "tB",
        homeMoneylineAmerican: -200,
        awayMoneylineAmerican: 170,
        homeSpreadPoints: -3.5,
      }),
      g({
        nflGameId: "g2",
        homeTeamId: "tC",
        awayTeamId: "tD",
        homeMoneylineAmerican: -200,
        awayMoneylineAmerican: 170,
        homeSpreadPoints: -3.5,
      }),
    ];
    const r = resolveJailedTeam(games, "   ");
    expect(r).toEqual(
      expect.objectContaining({
        ok: false,
        code: "JAILED_RESOLUTION_INCONSISTENT",
      }),
    );
  });

  it("excludes games with no real favorite (both moneylines positive) from candidates", () => {
    const r = resolveJailedTeam(
      [
        // Both teams underdogs — no favorite exists; per Algorithm step 3 this game must not
        // be considered. Without the filter, +120 would be elected as the week's "biggest favorite".
        g({
          nflGameId: "g1",
          homeTeamId: "tA",
          awayTeamId: "tB",
          homeMoneylineAmerican: 120,
          awayMoneylineAmerican: 200,
          homeSpreadPoints: -1,
        }),
        g({
          nflGameId: "g2",
          homeTeamId: "tC",
          awayTeamId: "tD",
          homeMoneylineAmerican: -180,
          awayMoneylineAmerican: 150,
          homeSpreadPoints: -3,
        }),
      ],
      seed,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.jailedTeamId).toBe("tC");
      expect(r.result.resolvedBy).toBe("MONEYLINE");
      expect(r.result.audit.gamesInWeek).toBe(2);
      expect(r.result.audit.gamesWithCompleteLines).toBe(1);
      expect(r.result.audit.candidates).toHaveLength(1);
      expect(r.result.audit.candidates[0]!.nflGameId).toBe("g2");
    }
  });

  it("returns NO_COMPLETE_MONEYLINES when every game has only positive moneylines", () => {
    const r = resolveJailedTeam(
      [
        g({
          nflGameId: "g1",
          homeMoneylineAmerican: 120,
          awayMoneylineAmerican: 200,
          homeSpreadPoints: -1,
        }),
        g({
          nflGameId: "g2",
          homeMoneylineAmerican: 100,
          awayMoneylineAmerican: 100,
          homeSpreadPoints: 0,
        }),
      ],
      seed,
    );
    expect(r).toEqual(
      expect.objectContaining({
        ok: false,
        code: "NO_COMPLETE_MONEYLINES",
      }),
    );
  });

  it("uses signed spread magnitude so SPREAD tie-break demotes ML/spread disagreement", () => {
    // Both games tie at -110/-110 → spec rule picks home as the ML favorite. Game A's spread
    // agrees (home is also the spread favorite by 1.5); Game B's spread disagrees (away is the
    // spread favorite by 7). With signed magnitude the values are +1.5 and −7; max is +1.5, so
    // game A's home team wins. Pre-fix `Math.abs` would have given 1.5 vs 7 → wrong team.
    const r = resolveJailedTeam(
      [
        g({
          nflGameId: "gA",
          homeTeamId: "homeA",
          awayTeamId: "awayA",
          homeMoneylineAmerican: -110,
          awayMoneylineAmerican: -110,
          homeSpreadPoints: -1.5,
        }),
        g({
          nflGameId: "gB",
          homeTeamId: "homeB",
          awayTeamId: "awayB",
          homeMoneylineAmerican: -110,
          awayMoneylineAmerican: -110,
          homeSpreadPoints: 7,
        }),
      ],
      seed,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.resolvedBy).toBe("SPREAD");
      expect(r.result.jailedTeamId).toBe("homeA");
      const cA = r.result.audit.candidates.find((c) => c.nflGameId === "gA")!;
      const cB = r.result.audit.candidates.find((c) => c.nflGameId === "gB")!;
      expect(cA.spreadInFavoriteFavor).toBe(1.5);
      expect(cB.spreadInFavoriteFavor).toBe(-7);
    }
  });

  it("handles pick'em (homeSpreadPoints === 0) without crashing or skewing the tie-break", () => {
    const r = resolveJailedTeam(
      [
        g({
          nflGameId: "g1",
          homeTeamId: "tA",
          awayTeamId: "tB",
          homeMoneylineAmerican: -110,
          awayMoneylineAmerican: -110,
          homeSpreadPoints: 0,
        }),
      ],
      seed,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.jailedTeamId).toBe("tA");
      expect(r.result.resolvedBy).toBe("MONEYLINE");
      // `-sp` with sp=0 yields -0 in JS; either polarity is fine — what matters is no crash and zero magnitude.
      expect(Math.abs(r.result.audit.candidates[0]!.spreadInFavoriteFavor)).toBe(0);
    }
  });

  it("persists the full per-game odds in audit candidates (AC5: reproducible favorite determination)", () => {
    const r = resolveJailedTeam(
      [
        g({
          nflGameId: "g1",
          homeTeamId: "tA",
          awayTeamId: "tB",
          homeMoneylineAmerican: -250,
          awayMoneylineAmerican: 210,
          homeSpreadPoints: -6.5,
        }),
      ],
      seed,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.audit.candidates).toEqual([
        {
          nflGameId: "g1",
          homeTeamId: "tA",
          awayTeamId: "tB",
          homeMoneylineAmerican: -250,
          awayMoneylineAmerican: 210,
          homeSpreadPoints: -6.5,
          favoriteTeamId: "tA",
          favoriteMoneylineAmerican: -250,
          spreadInFavoriteFavor: 6.5,
        },
      ]);
    }
  });
});

describe("deterministicIndexFromSeed", () => {
  it("stays in range and is stable for a fixed seed", () => {
    const s = "face".repeat(16);
    expect(deterministicIndexFromSeed(s, 1)).toBe(0);
    const a = deterministicIndexFromSeed(s, 5);
    const b = deterministicIndexFromSeed(s, 5);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(5);
  });
});
