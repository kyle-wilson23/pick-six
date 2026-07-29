/** Sortable league row with optional recent-visit timestamp (Story 9.5). */
export type LeagueRowWithRecentVisit = {
  league: { name: string };
  lastVisitedAt: Date | null;
};

/**
 * Sort leagues by most recently visited (newest first), then name ascending.
 * Never-visited leagues (`lastVisitedAt === null`) sort after visited ones.
 */
export function sortLeaguesByRecentVisit<T extends LeagueRowWithRecentVisit>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const aVisited = a.lastVisitedAt?.getTime() ?? null;
    const bVisited = b.lastVisitedAt?.getTime() ?? null;

    if (aVisited !== null && bVisited !== null) {
      if (aVisited !== bVisited) {
        return bVisited - aVisited;
      }
    } else if (aVisited !== null) {
      return -1;
    } else if (bVisited !== null) {
      return 1;
    }

    return a.league.name.localeCompare(b.league.name, undefined, { sensitivity: "base" });
  });
}
