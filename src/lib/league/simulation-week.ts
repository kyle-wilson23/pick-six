import { NFL_REGULAR_SEASON_WEEK_MAX } from "@/lib/nfl/nfl-regular-season";

/** Default `simulationWeekCount` offered at league creation (AC2) — shared by schema and form. */
export const DEFAULT_SIMULATION_WEEK_COUNT = 4;

/** Final NFL week index covered by a simulation starting at `firstCompetitionWeek`. */
export function finalSimulationWeek(
  firstCompetitionWeek: number,
  simulationWeekCount: number,
): number {
  return firstCompetitionWeek + simulationWeekCount - 1;
}

/**
 * Whether `firstCompetitionWeek` + `simulationWeekCount` stays within NFL Weeks 1–18.
 * Used at create-time for test leagues (AC2).
 */
export function isSimulationWeekCountValid(
  firstCompetitionWeek: number,
  simulationWeekCount: number,
): boolean {
  if (!Number.isInteger(firstCompetitionWeek) || !Number.isInteger(simulationWeekCount)) {
    return false;
  }
  if (simulationWeekCount < 1 || simulationWeekCount > NFL_REGULAR_SEASON_WEEK_MAX) {
    return false;
  }
  return finalSimulationWeek(firstCompetitionWeek, simulationWeekCount) <= NFL_REGULAR_SEASON_WEEK_MAX;
}

/** True when the simulation pointer is on (or, defensively, past) the configured final week. */
export function isSimulationComplete(args: {
  firstCompetitionWeek: number;
  simulationWeekCount: number;
  simulatedCurrentWeek: number;
}): boolean {
  return (
    args.simulatedCurrentWeek >=
    finalSimulationWeek(args.firstCompetitionWeek, args.simulationWeekCount)
  );
}

/**
 * Next week after advancing, or `null` when not started / already complete / misconfigured.
 */
export function nextSimulationWeek(args: {
  firstCompetitionWeek: number;
  simulationWeekCount: number | null;
  simulatedCurrentWeek: number | null;
}): number | null {
  const { firstCompetitionWeek, simulationWeekCount, simulatedCurrentWeek } = args;
  if (simulationWeekCount == null || simulatedCurrentWeek == null) {
    return null;
  }
  if (
    isSimulationComplete({
      firstCompetitionWeek,
      simulationWeekCount,
      simulatedCurrentWeek,
    })
  ) {
    return null;
  }
  return simulatedCurrentWeek + 1;
}
