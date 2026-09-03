/**
 * FR26: the pick deadline is **five minutes before the first scheduled kickoff of the NFL week**,
 * with **no weekday anchor**. See `computePickDeadlineUtc` and `src/lib/league/league-rules.ts`.
 *
 * Do **not** reintroduce a Thursday-anchored leg: it only coincided with the intent in weeks whose
 * first game is Thursday Night Football, and locked 2026 Weeks 1, 12 (Wednesday openers) and 18
 * (no Thursday game) days early — an NFR24 early-lockout violation.
 */

export const PICK_DEADLINE_PASSED_USER_MESSAGE = "The pick window for this week has closed.";

/** FR26: minutes between the pick deadline and the week's first kickoff. */
export const PICK_DEADLINE_LEAD_MINUTES = 5;

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
 * FR26: `firstKickoff − PICK_DEADLINE_LEAD_MINUTES`, compared/stored as UTC. Immune to schedule
 * shape — Wednesday, Saturday, Sunday-only and 09:30 ET international openers all resolve without
 * special cases. Does **not** load games; pass `getFirstKickoffUtc`'s result.
 */
export function computePickDeadlineUtc(firstKickoff: Date): Date {
  return new Date(firstKickoff.getTime() - PICK_DEADLINE_LEAD_MINUTES * 60 * 1000);
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

/**
 * Admin/export reveal gate. Live leagues use the kickoff deadline.
 * Test leagues copy real NFL `kickoffAt` onto sim games, so wall-clock is often
 * still before those deadlines after the sim pointer has moved on — treat any
 * week before `simulatedCurrentWeek` as closed.
 */
export function isLeagueWeekPickWindowClosed(args: {
  at: Date;
  weekNumber: number;
  games: { kickoffAt: Date | null }[];
  isTestLeague: boolean;
  simulatedCurrentWeek?: number | null;
}): boolean {
  if (
    args.isTestLeague &&
    args.simulatedCurrentWeek != null &&
    args.weekNumber < args.simulatedCurrentWeek
  ) {
    return true;
  }
  return isNflWeekPickWindowClosedByDeadline({ at: args.at, games: args.games });
}
