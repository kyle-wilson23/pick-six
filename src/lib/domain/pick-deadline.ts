import { subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";

/**
 * FR26: five minutes before the first game of the week **or** Thursday 8:10 PM
 * `LEAGUE_BUSINESS_TIMEZONE` — **whichever is earlier (stricter)**. See
 * `computePickDeadlineUtc` and `src/lib/league/league-rules.ts`.
 */

export const PICK_DEADLINE_PASSED_USER_MESSAGE = "The pick window for this week has closed.";

/**
 * Earliest `kickoffAt` in the week, or `null` if any are missing or the list is empty.
 */
export function getFirstKickoffUtc(games: { kickoffAt: Date | null }[]): Date | null {
  if (games.length === 0) {
    return null;
  }
  const times: number[] = [];
  for (const g of games) {
    if (g.kickoffAt == null) {
      return null;
    }
    times.push(g.kickoffAt.getTime());
  }
  return new Date(Math.min(...times));
}

/**
 * `firstKickoff` minus five minutes, compared/stored as UTC.
 */
export function lockByFirstGameUtc(firstKickoff: Date): Date {
  return new Date(firstKickoff.getTime() - 5 * 60 * 1000);
}

/**
 * Thursday 8:10 PM (20:10) in `timeZone` on the **Eastern** calendar Thursday that is
 * **on or before** the **Eastern** calendar day of `firstKickoff` (inclusive: if the first game is
 * on a Thursday, that same calendar day is used).
 */
export function lockByThursdayDefaultUtc(firstKickoff: Date, timeZone: string): Date {
  const ymd = formatInTimeZone(firstKickoff, timeZone, "yyyy-MM-dd");
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10) as number);

  // Anchor at local noon in the business zone so one-day `subDay` steps track the local calendar
  // (including through DST) when re-read with `formatInTimeZone` each iteration.
  let cursor = fromZonedTime(new Date(y, m - 1, d, 12, 0, 0), timeZone);
  for (let i = 0; i < 7; i++) {
    if (formatInTimeZone(cursor, timeZone, "i") === "4") {
      break;
    }
    cursor = subDays(cursor, 1);
  }

  const thYmd = formatInTimeZone(cursor, timeZone, "yyyy-MM-dd");
  const [ty, tm, td] = thYmd.split("-").map((x) => parseInt(x, 10) as number);
  return fromZonedTime(new Date(ty, tm - 1, td, 20, 10, 0), timeZone);
}

/**
 * PRD / FR26: min(firstGame − 5m, Thursday 8:10 PM America/New_York on the on-or-before Thursday) in
 * absolute UTC. Does **not** load games; pass `getFirstKickoffUtc`’s result.
 */
export function computePickDeadlineUtc(firstKickoff: Date): Date {
  const a = lockByFirstGameUtc(firstKickoff);
  const b = lockByThursdayDefaultUtc(firstKickoff, LEAGUE_BUSINESS_TIMEZONE);
  return new Date(Math.min(a.getTime(), b.getTime()));
}

/**
 * `true` when the pick window is **strictly** closed: `at` is **after** the computed deadline
 * (equality means still open).
 * Returns `false` if the deadline cannot be determined (`games` incomplete / empty / missing kickoff).
 */
export function isNflWeekPickWindowClosedByDeadline(args: {
  at: Date;
  games: { kickoffAt: Date | null }[];
}): boolean {
  const first = getFirstKickoffUtc(args.games);
  if (!first) {
    return false;
  }
  const deadline = computePickDeadlineUtc(first);
  return args.at.getTime() > deadline.getTime();
}
