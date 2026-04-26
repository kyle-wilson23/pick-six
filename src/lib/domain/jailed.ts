import { createHash } from "node:crypto";

/**
 * One NFL game's odds after effective-odds resolution. Spread is **home-relative** (negative = home favored).
 * The favorite's spread is reported as a **signed magnitude in the chosen favorite's favor** —
 * positive when ML and spread agree on which side is favored, negative when they disagree (so the
 * SPREAD tie-break demotes disagreement rather than silently absorbing it via `Math.abs`).
 */
export type JailedGameInput = {
  nflGameId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeMoneylineAmerican: number | null;
  awayMoneylineAmerican: number | null;
  homeSpreadPoints: number | null;
};

export type JailedResolvedBy = "MONEYLINE" | "SPREAD" | "RANDOM";

/**
 * Per-candidate audit row, sufficient for Story 4.4 jailed verification view to reproduce the
 * favorite-side determination from the persisted row alone (Story 3.3 AC5: "odds and spread
 * values used"). Includes both teams, both raw moneylines, and the raw home-relative spread —
 * not just the chosen-favorite-side fields.
 */
export type JailedCandidateAudit = {
  nflGameId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeMoneylineAmerican: number;
  awayMoneylineAmerican: number;
  /** Raw home-relative spread (negative = home favored on the spread). */
  homeSpreadPoints: number;
  favoriteTeamId: string;
  favoriteMoneylineAmerican: number;
  /**
   * Signed spread magnitude in the chosen favorite's favor. Positive when ML and spread agree on
   * the favorite side, negative when they disagree. The SPREAD tie-break still takes the maximum,
   * which correctly demotes disagreement-direction candidates.
   */
  spreadInFavoriteFavor: number;
};

export type JailedResult = {
  jailedTeamId: string;
  resolvedBy: JailedResolvedBy;
  /** Present only when `resolvedBy === 'RANDOM'` (audit / FR52). */
  randomSeed: string | undefined;
  audit: {
    gamesInWeek: number;
    gamesWithCompleteLines: number;
    candidates: JailedCandidateAudit[];
    winningMoneylineAmerican: number;
    tieLevel: "MONEYLINE" | "SPREAD" | "RANDOM";
  };
};

export type JailedErrorCode =
  | "NO_GAMES_FOR_WEEK"
  | "NO_COMPLETE_MONEYLINES"
  | "JAILED_RESOLUTION_INCONSISTENT";

export type JailedFailure = {
  ok: false;
  code: JailedErrorCode;
  message: string;
};

/**
 * @param randomSeed – Hex string (e.g. 32 bytes from `crypto.randomBytes`), **required** for the
 *   algorithm when the random tie-break can apply; the caller generates it before invoking so
 *   runs are reproducible given the same seed. If a random tie is impossible (single candidate after ML),
 *   the seed is ignored.
 */
export function resolveJailedTeam(
  games: JailedGameInput[],
  randomSeed: string,
): { ok: true; result: JailedResult } | JailedFailure {
  if (games.length === 0) {
    return {
      ok: false,
      code: "NO_GAMES_FOR_WEEK",
      message: "No NFL games found for this season week — cannot determine jailed team.",
    };
  }

  const candidates: JailedCandidateAudit[] = [];
  for (const g of games) {
    const hm = g.homeMoneylineAmerican;
    const am = g.awayMoneylineAmerican;
    const sp = g.homeSpreadPoints;
    if (hm === null || am === null || sp === null) {
      continue;
    }
    // Algorithm step 3: "Do not compare underdog moneylines to favorites." A game with both
    // moneylines >= 0 has no real favorite (theoretical / data-quality guard) and is excluded
    // so a +150 team is never elected as the week's "biggest favorite".
    if (hm >= 0 && am >= 0) {
      continue;
    }
    const side = pickFavoriteSide(hm, am);
    const favoriteTeamId = side === "home" ? g.homeTeamId : g.awayTeamId;
    const favoriteMoneylineAmerican = side === "home" ? hm : am;
    const spreadInFavoriteFavor = side === "home" ? -sp : sp;
    candidates.push({
      nflGameId: g.nflGameId,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeMoneylineAmerican: hm,
      awayMoneylineAmerican: am,
      homeSpreadPoints: sp,
      favoriteTeamId,
      favoriteMoneylineAmerican,
      spreadInFavoriteFavor,
    });
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      code: "NO_COMPLETE_MONEYLINES",
      message:
        "No games in this week have a real favorite (both moneylines, a home spread, and at least one negative moneyline) — cannot determine jailed team.",
    };
  }

  const bestMl = Math.min(...candidates.map((c) => c.favoriteMoneylineAmerican));
  const afterMl = candidates.filter((c) => c.favoriteMoneylineAmerican === bestMl);
  if (afterMl.length === 1) {
    const c = afterMl[0]!;
    return {
      ok: true,
      result: buildResult(c.favoriteTeamId, "MONEYLINE", undefined, {
        gamesInWeek: games.length,
        gamesWithCompleteLines: candidates.length,
        candidates,
        winningMoneylineAmerican: bestMl,
        tieLevel: "MONEYLINE",
      }),
    };
  }

  const bestSpread = Math.max(...afterMl.map((c) => c.spreadInFavoriteFavor));
  const afterSpread = afterMl.filter((c) => c.spreadInFavoriteFavor === bestSpread);
  if (afterSpread.length === 1) {
    const c = afterSpread[0]!;
    return {
      ok: true,
      result: buildResult(c.favoriteTeamId, "SPREAD", undefined, {
        gamesInWeek: games.length,
        gamesWithCompleteLines: candidates.length,
        candidates,
        winningMoneylineAmerican: bestMl,
        tieLevel: "SPREAD",
      }),
    };
  }

  if (!randomSeed?.trim()) {
    return {
      ok: false,
      code: "JAILED_RESOLUTION_INCONSISTENT",
      message: "Random tie-break required but no random seed was provided.",
    };
  }

  // FR52 reproducibility: byte-wise comparator (locale-independent across hosts/ICU builds).
  const teamIds = [...new Set(afterSpread.map((c) => c.favoriteTeamId))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const idx = deterministicIndexFromSeed(randomSeed, teamIds.length);
  const jailedTeamId = teamIds[idx]!;

  return {
    ok: true,
    result: buildResult(jailedTeamId, "RANDOM", randomSeed, {
      gamesInWeek: games.length,
      gamesWithCompleteLines: candidates.length,
      candidates,
      winningMoneylineAmerican: bestMl,
      tieLevel: "RANDOM",
    }),
  };
}

function pickFavoriteSide(
  homeMoneylineAmerican: number,
  awayMoneylineAmerican: number,
): "home" | "away" {
  // Story 3.3 Algorithm step 2: equal-ML edge case is documented to break to home.
  if (homeMoneylineAmerican === awayMoneylineAmerican) {
    return "home";
  }
  return homeMoneylineAmerican < awayMoneylineAmerican ? "home" : "away";
}

function buildResult(
  jailedTeamId: string,
  resolvedBy: JailedResolvedBy,
  randomSeed: string | undefined,
  args: {
    gamesInWeek: number;
    gamesWithCompleteLines: number;
    candidates: JailedCandidateAudit[];
    winningMoneylineAmerican: number;
    tieLevel: "MONEYLINE" | "SPREAD" | "RANDOM";
  },
): JailedResult {
  return {
    jailedTeamId,
    resolvedBy,
    randomSeed: resolvedBy === "RANDOM" ? randomSeed : undefined,
    audit: {
      gamesInWeek: args.gamesInWeek,
      gamesWithCompleteLines: args.gamesWithCompleteLines,
      candidates: args.candidates,
      winningMoneylineAmerican: args.winningMoneylineAmerican,
      tieLevel: args.tieLevel,
    },
  };
}

/**
 * Deterministic index in `0..n-1` from a hex seed (SHA-256, first 4 bytes); stable across Node versions.
 */
export function deterministicIndexFromSeed(seedHex: string, n: number): number {
  if (n <= 0) {
    return 0;
  }
  const buf = createHash("sha256").update(seedHex, "utf8").digest();
  const u = buf.readUInt32BE(0);
  return u % n;
}
