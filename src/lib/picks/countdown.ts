/**
 * Story 3.7 — pure countdown formatting + lock detection for the picks page.
 *
 * The server is the authority for the actual deadline (`pickDeadlineUtc` in the
 * GET payload + `checkPickMutationDeadline` on POST). These helpers only drive
 * the **client UX** (label + urgency band + a same-tick lock signal).
 */

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const FOUR_HOURS_MS = 4 * HOUR_MS;
export const FORTY_EIGHT_HOURS_MS = 48 * HOUR_MS;

export type CountdownUrgency = "calm" | "elevated" | "critical" | "passed";

export type CountdownVariant = {
  /** Display label, e.g. "2d 3h 14m", "12m 45s", or "Deadline passed". */
  label: string;
  /** Visual urgency band per UX § DeadlineCountdown. */
  urgency: CountdownUrgency;
};

/**
 * Returns the display label + urgency for a remaining duration in ms.
 * - `> 48h` → calm
 * - `4h–48h` (inclusive of 48h) → elevated
 * - `< 4h` (and > 0) → critical
 * - `≤ 0` → passed
 *
 * Label format:
 * - `> 1h` → `Xd Xh Xm`
 * - `≤ 1h` (and > 0) → `Xm Xs`
 * - `≤ 0` → `Deadline passed`
 */
export function getCountdownVariant(remainingMs: number): CountdownVariant {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return { label: "Deadline passed", urgency: "passed" };
  }

  let urgency: CountdownUrgency;
  if (remainingMs < FOUR_HOURS_MS) {
    urgency = "critical";
  } else if (remainingMs <= FORTY_EIGHT_HOURS_MS) {
    urgency = "elevated";
  } else {
    urgency = "calm";
  }

  let label: string;
  if (remainingMs > HOUR_MS) {
    const days = Math.floor(remainingMs / DAY_MS);
    const hours = Math.floor((remainingMs - days * DAY_MS) / HOUR_MS);
    const minutes = Math.floor(
      (remainingMs - days * DAY_MS - hours * HOUR_MS) / MINUTE_MS,
    );
    label = `${days}d ${hours}h ${minutes}m`;
  } else {
    const minutes = Math.floor(remainingMs / MINUTE_MS);
    const seconds = Math.floor((remainingMs - minutes * MINUTE_MS) / SECOND_MS);
    label = `${minutes}m ${seconds}s`;
  }

  return { label, urgency };
}

/**
 * Client-side wrapper for "is the pick window closed?" given a payload deadline ISO string
 * and the current `Date`. Returns `false` for `null` / unparseable inputs (deadline unknown
 * → assume open; the **server** still rejects late POSTs as the safety net).
 */
export function isPickWindowClosedByDeadline(
  pickDeadlineUtc: string | null,
  now: Date,
): boolean {
  if (pickDeadlineUtc == null) {
    return false;
  }
  const deadline = Date.parse(pickDeadlineUtc);
  if (!Number.isFinite(deadline)) {
    return false;
  }
  return now.getTime() > deadline;
}
