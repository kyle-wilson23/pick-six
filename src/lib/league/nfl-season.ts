/**
 * NFL **season label year** stored on `Season.nfl_season_year` (e.g. `2025` for the season
 * commonly called “2025”).
 *
 * **Configuration:** set `NFL_SEASON_YEAR` to a 2000–2100 integer for tests, staging, or when
 * the deployment should not follow the default. If unset, uses the current **UTC** calendar year
 * (MVP simplification; refine with Eastern “league year” logic later if product requires it).
 */
export function getCurrentNflSeasonYear(now: Date = new Date()): number {
  const raw = process.env.NFL_SEASON_YEAR;
  if (raw !== undefined && raw !== "") {
    const n = Number.parseInt(raw, 10);
    if (Number.isInteger(n) && n >= 2000 && n <= 2100) {
      return n;
    }
  }
  return now.getUTCFullYear();
}
