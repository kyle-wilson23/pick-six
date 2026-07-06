import "server-only";

/**
 * Returns whether `now` falls within an Eastern-time day/hour window.
 *
 * @param dayOfWeek 0=Sun … 6=Sat (Eastern wall clock)
 * @param startHour inclusive 24h Eastern hour
 * @param endHour exclusive 24h Eastern hour (use 24 for midnight end)
 */
/** Eastern wall-clock components for `now` (0=Sun … 6=Sat). */
export function getEasternWallClock(now: Date): {
  dayOfWeek: number;
  hour: number;
  minute: number;
} {
  const nowET = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return {
    dayOfWeek: nowET.getDay(),
    hour: nowET.getHours(),
    minute: nowET.getMinutes(),
  };
}

export function isInEasternWindow(
  now: Date,
  dayOfWeek: number,
  startHour: number,
  endHour: number,
): boolean {
  const { dayOfWeek: etDay, hour } = getEasternWallClock(now);
  return etDay === dayOfWeek && hour >= startHour && hour < endHour;
}

/** True when Eastern wall clock is on or after `dayOfWeek` at `hour`:00. */
export function isOnOrAfterEasternDayHour(now: Date, dayOfWeek: number, hour: number): boolean {
  const { dayOfWeek: etDay, hour: etHour } = getEasternWallClock(now);
  return etDay > dayOfWeek || (etDay === dayOfWeek && etHour >= hour);
}

/** True when Eastern wall clock is before `dayOfWeek` at `hour`:00. */
export function isBeforeEasternDayHour(now: Date, dayOfWeek: number, hour: number): boolean {
  return !isOnOrAfterEasternDayHour(now, dayOfWeek, hour);
}
