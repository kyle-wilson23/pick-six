/**
 * Maps cron job summary counters to HTTP status for external monitors (Story 7.4).
 * `outside_window` skips stay 200 (handled by the route before this helper).
 */
export function cronJobHttpStatus(failed: number): number {
  return failed > 0 ? 500 : 200;
}
