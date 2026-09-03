import { fromZonedTime } from "date-fns-tz";

import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";
import type { MinimalNflGameForPicksWeek } from "@/lib/nfl/resolve-picks-week";

/** Wall clock in `America/New_York` → UTC `Date` (for fixed test vectors). */
export function easternLocal(
  y: number,
  m0: number,
  day: number,
  h: number,
  min: number,
): Date {
  return fromZonedTime(new Date(y, m0, day, h, min, 0), LEAGUE_BUSINESS_TIMEZONE);
}

/**
 * 2026 regular season, first kickoff per week (ET). Weeks 2–11 and 13–17 open with TNF at 20:15;
 * Weeks 1 and 12 open on a Wednesday and Week 18 has no Thursday game at all.
 *
 * Shared by the pick-window (FR26a) and reminder-slot (Rule C) suites so both reason about the
 * same schedule shape.
 */
export const SEASON_2026_OPENERS: MinimalNflGameForPicksWeek[] = [
  { weekNumber: 1, kickoffAt: easternLocal(2026, 8, 9, 20, 15) },
  { weekNumber: 2, kickoffAt: easternLocal(2026, 8, 17, 20, 15) },
  { weekNumber: 3, kickoffAt: easternLocal(2026, 8, 24, 20, 15) },
  { weekNumber: 4, kickoffAt: easternLocal(2026, 9, 1, 20, 15) },
  { weekNumber: 5, kickoffAt: easternLocal(2026, 9, 8, 20, 15) },
  { weekNumber: 6, kickoffAt: easternLocal(2026, 9, 15, 20, 15) },
  { weekNumber: 7, kickoffAt: easternLocal(2026, 9, 22, 20, 15) },
  { weekNumber: 8, kickoffAt: easternLocal(2026, 9, 29, 20, 15) },
  { weekNumber: 9, kickoffAt: easternLocal(2026, 10, 5, 20, 15) },
  { weekNumber: 10, kickoffAt: easternLocal(2026, 10, 12, 20, 15) },
  { weekNumber: 11, kickoffAt: easternLocal(2026, 10, 19, 20, 15) },
  { weekNumber: 12, kickoffAt: easternLocal(2026, 10, 25, 20, 0) },
  { weekNumber: 13, kickoffAt: easternLocal(2026, 11, 3, 20, 15) },
  { weekNumber: 14, kickoffAt: easternLocal(2026, 11, 10, 20, 15) },
  { weekNumber: 15, kickoffAt: easternLocal(2026, 11, 17, 20, 15) },
  { weekNumber: 16, kickoffAt: easternLocal(2026, 11, 24, 20, 15) },
  { weekNumber: 17, kickoffAt: easternLocal(2026, 11, 31, 20, 15) },
  { weekNumber: 18, kickoffAt: easternLocal(2027, 0, 10, 13, 0) },
];
