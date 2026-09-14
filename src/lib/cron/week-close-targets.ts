import {
  resolvePicksWeekNumber,
  type MinimalNflGameForPicksWeek,
} from "@/lib/nfl/resolve-picks-week";

/** Canonical slate: production week-close is not league-FCW scoped. */
const CANONICAL_SEASON = {
  preSeasonInitializedAt: new Date(0),
  firstCompetitionWeek: 1,
};

export type WeekCloseTargets = {
  openingWeek: number;
  closedWeek: number | null;
  snapshotWeek: number | null;
};

/**
 * Closed week to finalize vs opening week to snapshot/jailed, from canonical `NflGame` kickoffs.
 */
export function resolveWeekCloseTargets(
  games: MinimalNflGameForPicksWeek[],
  now: Date,
): WeekCloseTargets {
  const openingWeek = resolvePicksWeekNumber(CANONICAL_SEASON, games, now);

  if (games.length === 0) {
    return { openingWeek, closedWeek: null, snapshotWeek: openingWeek };
  }

  const hasFutureKickoff = games.some((g) => g.kickoffAt.getTime() > now.getTime());
  if (!hasFutureKickoff) {
    return { openingWeek, closedWeek: openingWeek, snapshotWeek: null };
  }

  if (openingWeek <= 1) {
    return { openingWeek: 1, closedWeek: null, snapshotWeek: 1 };
  }

  return {
    openingWeek,
    closedWeek: openingWeek - 1,
    snapshotWeek: openingWeek,
  };
}
