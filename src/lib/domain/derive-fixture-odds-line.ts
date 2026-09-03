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

/** Favorite decimal inclusive range (hundredths): 1.22 … 1.91. */
const FAVORITE_HUNDREDTHS_MIN = 122;
const FAVORITE_HUNDREDTHS_MAX = 191;
/** Underdog decimal inclusive range (hundredths): 2.00 … 5.40. */
const DOG_HUNDREDTHS_MIN = 200;
const DOG_HUNDREDTHS_MAX = 540;
/** Half-point spread magnitude steps: 0.5 … 14.0 → 28 values. */
const SPREAD_HALF_STEPS = 28;

/**
 * Deterministic fixture odds for rehearsal (Story 8.3). Pure hash of
 * `(nflSeasonYear, weekNumber, homeTeamId, awayTeamId)` — no `Date.now()` / `Math.random()`.
 *
 * Always produces a lower-decimal favorite so `resolveJailedTeam` treats the game as having
 * a real favorite.
 */
export function deriveFixtureOddsLine(input: FixtureOddsLineInput): FixtureOddsLine {
  const seed = `${input.nflSeasonYear}:${input.weekNumber}:${input.homeTeamId}:${input.awayTeamId}`;
  const buf = createHash("sha256").update(seed, "utf8").digest();

  const homeIsFavorite = (buf[0]! & 1) === 0;

  const favSpan = FAVORITE_HUNDREDTHS_MAX - FAVORITE_HUNDREDTHS_MIN;
  const favHundredths = FAVORITE_HUNDREDTHS_MAX - (readU16(buf, 1) % (favSpan + 1));
  const favoriteMl = favHundredths / 100;

  const dogSpan = DOG_HUNDREDTHS_MAX - DOG_HUNDREDTHS_MIN;
  const dogHundredths = DOG_HUNDREDTHS_MIN + (readU16(buf, 3) % (dogSpan + 1));
  const underdogMl = dogHundredths / 100;

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
