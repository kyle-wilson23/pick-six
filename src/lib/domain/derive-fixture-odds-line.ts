import { createHash } from "node:crypto";

export type FixtureOddsLineInput = {
  nflSeasonYear: number;
  weekNumber: number;
  homeTeamId: string;
  awayTeamId: string;
};

export type FixtureOddsLine = {
  homeMoneylineAmerican: number;
  awayMoneylineAmerican: number;
  homeSpreadPoints: number;
};

/** Favorite moneyline inclusive range (American). */
const FAVORITE_ML_MIN = -450;
const FAVORITE_ML_MAX = -110;
/** Underdog moneyline inclusive range (American). */
const UNDERDOG_ML_MIN = 100;
const UNDERDOG_ML_MAX = 440;
/** Half-point spread magnitude steps: 0.5 … 14.0 → 28 values. */
const SPREAD_HALF_STEPS = 28;

/**
 * Deterministic fixture odds for rehearsal (Story 8.3). Pure hash of
 * `(nflSeasonYear, weekNumber, homeTeamId, awayTeamId)` — no `Date.now()` / `Math.random()`.
 *
 * Always produces exactly one negative moneyline (favorite) so `resolveJailedTeam` treats the
 * game as having a real favorite.
 */
export function deriveFixtureOddsLine(input: FixtureOddsLineInput): FixtureOddsLine {
  const seed = `${input.nflSeasonYear}:${input.weekNumber}:${input.homeTeamId}:${input.awayTeamId}`;
  const buf = createHash("sha256").update(seed, "utf8").digest();

  const homeIsFavorite = (buf[0]! & 1) === 0;

  const favMlSpan = FAVORITE_ML_MAX - FAVORITE_ML_MIN; // 340 → 341 inclusive values
  const favOffset = readU16(buf, 1) % (favMlSpan + 1);
  const favoriteMl = FAVORITE_ML_MAX - favOffset; // -110 … -450

  const dogMlSpan = UNDERDOG_ML_MAX - UNDERDOG_ML_MIN; // 340 → 341 inclusive values
  const dogOffset = readU16(buf, 3) % (dogMlSpan + 1);
  const underdogMl = UNDERDOG_ML_MIN + dogOffset; // +100 … +440

  const halfSteps = 1 + (readU16(buf, 5) % SPREAD_HALF_STEPS); // 1…28
  const spreadMagnitude = halfSteps * 0.5; // 0.5…14.0

  if (homeIsFavorite) {
    return {
      homeMoneylineAmerican: favoriteMl,
      awayMoneylineAmerican: underdogMl,
      homeSpreadPoints: -spreadMagnitude,
    };
  }

  return {
    homeMoneylineAmerican: underdogMl,
    awayMoneylineAmerican: favoriteMl,
    homeSpreadPoints: spreadMagnitude,
  };
}

function readU16(buf: Buffer, offset: number): number {
  return buf.readUInt16BE(offset);
}
