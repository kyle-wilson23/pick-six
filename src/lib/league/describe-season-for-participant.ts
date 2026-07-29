/** Season slice used by participant-facing copy helpers. */
export type ParticipantSeasonSummary = null | {
  nflSeasonYear: number;
  firstCompetitionWeek: number;
  firstCompetitionWeekLockedAt: Date | null;
  preSeasonInitializedAt: Date | null;
};

/** Participant-facing one-line season summary (Story 2.5 AC1, AC8). */
export function describeSeasonForParticipant(args: {
  nflSeasonYear: number;
  season: ParticipantSeasonSummary;
}): string {
  const { nflSeasonYear, season } = args;
  if (!season) {
    return `This league does not have season details for NFL ${nflSeasonYear} yet. If that continues, ask a league admin.`;
  }
  const weekNote =
    season.firstCompetitionWeek > 1
      ? `Competition starts NFL Week ${season.firstCompetitionWeek}. `
      : "";
  const init = season.preSeasonInitializedAt
    ? "Pre-season initialized"
    : "Pre-season not yet initialized";
  const lockNote = season.firstCompetitionWeekLockedAt
    ? " Competition start is locked (week cannot be changed)."
    : "";
  return `${weekNote}Current season: ${season.nflSeasonYear} · First competition week ${season.firstCompetitionWeek} · ${init}.${lockNote}`;
}
