import "server-only";

import { isInEasternWindow } from "@/lib/cron/eastern-window";

/** Wed or Sat 11:00–17:00 ET. Saturday persists TNF before Odds `daysFrom=3` expires. */
export const NFL_RESULTS_CRON_ET_START = 11;
export const NFL_RESULTS_CRON_ET_END = 17;
export const NFL_RESULTS_CRON_WEDNESDAY = 3;
export const NFL_RESULTS_CRON_SATURDAY = 6;

export type NflResultsCronWindow = {
  inWindow: boolean;
  shouldFinalizeClosedWeek: boolean;
};

/**
 * Wednesday: sync scores and finalize the closed week (late MNF).
 * Saturday: sync scores only so Thursday (and Wednesday openers) stay FINAL for Tuesday scoring.
 */
export function resolveNflResultsCronWindow(now: Date = new Date()): NflResultsCronWindow {
  const wednesday = isInEasternWindow(
    now,
    NFL_RESULTS_CRON_WEDNESDAY,
    NFL_RESULTS_CRON_ET_START,
    NFL_RESULTS_CRON_ET_END,
  );
  const saturday = isInEasternWindow(
    now,
    NFL_RESULTS_CRON_SATURDAY,
    NFL_RESULTS_CRON_ET_START,
    NFL_RESULTS_CRON_ET_END,
  );
  return {
    inWindow: wednesday || saturday,
    shouldFinalizeClosedWeek: wednesday,
  };
}
