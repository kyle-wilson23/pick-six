/** Pure resolution of which NFL regular-season week the picks UX should show (Story 3.6). */

export type MinimalSeasonForPicksWeek = {
  preSeasonInitializedAt: Date | null;
  firstCompetitionWeek: number;
} | null;

export type MinimalNflGameForPicksWeek = {
  weekNumber: number;
  kickoffAt: Date;
};

/**
 * Returns the NFL week index to surface on the picks page.
 *
 * Algorithm (Dev Notes Story 3.6):
 * 1. No season row or not initialized → `first_competition_week` (default 1).
 * 2. Season initialized, has games:
 *    a. Lowest `weekNumber` with any future kickoff: if `< firstCompetitionWeek` → clamp to FCW (preview mid-season-start); else active week.
 *    b. If all kickoffs past → highest week among games with data (post-season viewing).
 * 3. No `NflGame` rows → FCW fallback.
 */
export function resolvePicksWeekNumber(
  season: MinimalSeasonForPicksWeek,
  gamesForYear: MinimalNflGameForPicksWeek[],
  now: Date = new Date(),
): number {
  const fcw =
    typeof season?.firstCompetitionWeek === "number"
      ? season.firstCompetitionWeek
      : 1;

  if (gamesForYear.length === 0) {
    return fcw;
  }

  if (!season || season.preSeasonInitializedAt == null) {
    return fcw;
  }

  const futureGames = gamesForYear.filter((g) => g.kickoffAt.getTime() > now.getTime());
  if (futureGames.length > 0) {
    const minWeek = Math.min(...futureGames.map((g) => g.weekNumber));
    if (minWeek < fcw) {
      return fcw;
    }
    return minWeek;
  }

  const maxWeek = Math.max(...gamesForYear.map((g) => g.weekNumber));
  return Number.isFinite(maxWeek) ? maxWeek : fcw;
}

/**
 * Preview banner: pre-season gates, schedule gaps, clamped FCW viewing, or before first competition-window kickoff.
 */
export function computePicksUiIsPreview(args: {
  season: { preSeasonInitializedAt: Date | null; firstCompetitionWeek: number } | null;
  resolvedWeekNumber: number;
  allSeasonGames: { weekNumber: number; kickoffAt: Date }[];
  now: Date;
}): boolean {
  const { season, resolvedWeekNumber, allSeasonGames, now } = args;
  const fcw =
    typeof season?.firstCompetitionWeek === "number" ? season.firstCompetitionWeek : 1;

  if (!season?.preSeasonInitializedAt) {
    return true;
  }
  if (allSeasonGames.length === 0) {
    return true;
  }
  if (resolvedWeekNumber < fcw) {
    return true;
  }

  let earliestCompKick: Date | null = null;
  for (const g of allSeasonGames) {
    if (g.weekNumber < fcw) {
      continue;
    }
    if (earliestCompKick == null || g.kickoffAt.getTime() < earliestCompKick.getTime()) {
      earliestCompKick = g.kickoffAt;
    }
  }
  if (!earliestCompKick) {
    return true;
  }
  return now.getTime() < earliestCompKick.getTime();
}
