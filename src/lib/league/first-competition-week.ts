/**
 * Pure helpers for `Season.firstCompetitionWeek` editability (Story 2.7).
 * Lock timestamp is set by Epic 3 when competition has started; until then it stays null.
 */

export function isFirstCompetitionWeekEditable(season: {
  firstCompetitionWeekLockedAt: Date | null;
}): boolean {
  return season.firstCompetitionWeekLockedAt === null;
}

/** Short explanation for admin UI when the week is frozen. */
export function firstCompetitionWeekLockedReason(): string {
  return "Competition has started for this season, so the first competition week can no longer be changed.";
}
