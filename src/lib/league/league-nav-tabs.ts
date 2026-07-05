export type LeagueNavTab = {
  key: string;
  label: string;
  hrefSuffix: string;
  matchPaths: readonly string[];
};

export const LEAGUE_PARTICIPANT_TABS: readonly LeagueNavTab[] = [
  {
    key: "picks",
    label: "Picks",
    hrefSuffix: "/picks",
    matchPaths: ["/picks"],
  },
  {
    key: "standings",
    label: "Standings",
    hrefSuffix: "/standings",
    matchPaths: ["/standings"],
  },
  {
    key: "history",
    label: "History",
    hrefSuffix: "/history",
    matchPaths: ["/history"],
  },
  {
    key: "results",
    label: "Results",
    hrefSuffix: "/results",
    matchPaths: ["/results"],
  },
  {
    key: "rules",
    label: "Rules",
    hrefSuffix: "/rules",
    matchPaths: ["/rules"],
  },
] as const;

export const LEAGUE_ADMIN_TAB: LeagueNavTab = {
  key: "admin",
  label: "Admin",
  hrefSuffix: "/admin",
  matchPaths: ["/admin"],
};

export function buildLeagueTabHref(leagueId: string, hrefSuffix: string): string {
  return `/leagues/${leagueId}${hrefSuffix}`;
}

export function getLeagueNavTabs(isAdmin: boolean): LeagueNavTab[] {
  return isAdmin
    ? [...LEAGUE_PARTICIPANT_TABS, LEAGUE_ADMIN_TAB]
    : [...LEAGUE_PARTICIPANT_TABS];
}

/**
 * Returns the active tab key for league sub-routes, or `null` when no tab matches
 * (e.g. hub, settings, invites).
 */
export function getActiveLeagueTab(pathname: string, leagueId: string): string | null {
  const basePrefix = `/leagues/${leagueId}`;
  if (!pathname.startsWith(basePrefix)) {
    return null;
  }

  const pathWithoutQuery = pathname.split("?")[0] ?? pathname;
  const suffix = pathWithoutQuery.slice(basePrefix.length);

  if (suffix === "" || suffix === "/") {
    return null;
  }

  const tabs = getLeagueNavTabs(true);
  for (const tab of tabs) {
    for (const matchPath of tab.matchPaths) {
      if (suffix === matchPath || suffix.startsWith(`${matchPath}/`)) {
        return tab.key;
      }
    }
  }

  return null;
}
