import "server-only";

/**
 * Returns whether `now` falls within an Eastern-time day/hour window.
 *
 * @param dayOfWeek 0=Sun … 6=Sat (Eastern wall clock)
 * @param startHour inclusive 24h Eastern hour
 * @param endHour exclusive 24h Eastern hour (use 24 for midnight end)
 */
export function isInEasternWindow(
  now: Date,
  dayOfWeek: number,
  startHour: number,
  endHour: number,
): boolean {
  const nowET = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return (
    nowET.getDay() === dayOfWeek &&
    nowET.getHours() >= startHour &&
    nowET.getHours() < endHour
  );
}
