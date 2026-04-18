import { z } from "zod";

/** Inclusive NFL regular season week index (current league format). */
export const NFL_REGULAR_SEASON_WEEK_MIN = 1;
export const NFL_REGULAR_SEASON_WEEK_MAX = 18;

/** Zod schema for a single NFL regular season week number (use in APIs and seed validation). */
export const zNflRegularSeasonWeek = z.coerce
  .number()
  .int("NFL week must be a whole number")
  .min(NFL_REGULAR_SEASON_WEEK_MIN, `NFL week must be at least ${NFL_REGULAR_SEASON_WEEK_MIN}`)
  .max(NFL_REGULAR_SEASON_WEEK_MAX, `NFL week must be at most ${NFL_REGULAR_SEASON_WEEK_MAX}`);

export function isNflRegularSeasonWeek(n: number): boolean {
  return (
    Number.isInteger(n) &&
    n >= NFL_REGULAR_SEASON_WEEK_MIN &&
    n <= NFL_REGULAR_SEASON_WEEK_MAX
  );
}

/**
 * @throws Error when `n` is not an integer in `1..18` (for Zod `superRefine` / internal guards).
 */
export function assertNflRegularSeasonWeek(n: number, label = "NFL week"): void {
  if (!isNflRegularSeasonWeek(n)) {
    throw new Error(
      `${label} must be an integer between ${NFL_REGULAR_SEASON_WEEK_MIN} and ${NFL_REGULAR_SEASON_WEEK_MAX}`,
    );
  }
}

/**
 * Whether `nflWeekNumber` counts as in-league competition for this season.
 * Weeks **strictly before** `firstCompetitionWeek` are out of scope (pre-season / preview only).
 */
export function isWeekInLeagueCompetition(
  season: { firstCompetitionWeek: number },
  nflWeekNumber: number,
): boolean {
  if (!isNflRegularSeasonWeek(nflWeekNumber)) return false;
  return nflWeekNumber >= season.firstCompetitionWeek;
}
