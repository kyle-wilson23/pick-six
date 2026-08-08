import { computePicksUiIsPreview } from "@/lib/nfl/resolve-picks-week";

/**
 * Whether automated (cron) weekly emails may send for this league/week.
 *
 * Production leagues share the picks-UI preview definition: before the first
 * competition-window kickoff, cron must not send. Test/rehearsal leagues are
 * always treated as active here (cron already excludes them; admin override).
 */
export function isAutomatedEmailWeekActive(args: {
  isTestLeague: boolean;
  season: { preSeasonInitializedAt: Date | null; firstCompetitionWeek: number } | null;
  resolvedWeekNumber: number;
  allSeasonGames: { weekNumber: number; kickoffAt: Date }[];
  now?: Date;
}): boolean {
  const { isTestLeague, season, resolvedWeekNumber, allSeasonGames, now = new Date() } = args;
  if (isTestLeague) {
    return true;
  }
  return !computePicksUiIsPreview({
    season,
    resolvedWeekNumber,
    allSeasonGames,
    now,
    isTestLeague: false,
  });
}
