import { NFL_REGULAR_SEASON_WEEK_MAX, NFL_REGULAR_SEASON_WEEK_MIN } from "@/lib/nfl/nfl-regular-season";

/**
 * Parses `weekNumber` from search params — `undefined` if absent/cleared; **`null`** if invalid format/range.
 */
export function parseWeekNumberSearchParam(raw: unknown): number | undefined | null {
  const s = normalizeSearchParam(raw);
  if (s === undefined) {
    return undefined;
  }
  if (!/^\d+$/.test(s)) {
    return null;
  }
  const n = Number.parseInt(s, 10);
  if (
    !Number.isInteger(n) ||
    n < NFL_REGULAR_SEASON_WEEK_MIN ||
    n > NFL_REGULAR_SEASON_WEEK_MAX
  ) {
    return null;
  }
  return n;
}

function normalizeSearchParam(raw: unknown): string | undefined {
  if (Array.isArray(raw)) {
    return raw[0] != null && raw[0] !== "" ? String(raw[0]) : undefined;
  }
  if (raw == null) {
    return undefined;
  }
  const s = String(raw).trim();
  return s === "" ? undefined : s;
}
