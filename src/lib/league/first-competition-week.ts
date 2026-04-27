/**
 * Pure helpers for `Season.firstCompetitionWeek` editability (Story 2.7).
 * Lock timestamp is set by Epic 3 when competition has started; until then it stays null.
 */

export function isFirstCompetitionWeekEditable(season: {
  firstCompetitionWeekLockedAt: Date | null;
}): boolean {
  return season.firstCompetitionWeekLockedAt === null;
}

/**
 * **Story 2.7 / 3.4:** lock `firstCompetitionWeek` when the first pick is saved for the season
 * (any week). Call with `pickCountBeforeSave === 0` from the pick mutation transaction.
 */
export function isFirstPickForSeason(pickCountBeforeSave: number): boolean {
  return pickCountBeforeSave === 0;
}

/** Short explanation for admin UI when the week is frozen. */
export function firstCompetitionWeekLockedReason(): string {
  return "Competition has started for this season, so the first competition week can no longer be changed.";
}
