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

export const LEAGUE_INVITES_TAB: LeagueNavTab = {
  key: "invites",
  label: "Invites",
  hrefSuffix: "/invites",
  matchPaths: ["/invites"],
};

export const LEAGUE_SETTINGS_TAB: LeagueNavTab = {
  key: "settings",
  label: "Settings",
  hrefSuffix: "/settings",
  matchPaths: ["/settings"],
};

export function buildLeagueTabHref(leagueId: string, hrefSuffix: string): string {
  return `/leagues/${leagueId}${hrefSuffix}`;
}

export function getLeagueNavTabs(isAdmin: boolean): LeagueNavTab[] {
  const tabs = isAdmin
    ? [
        ...LEAGUE_PARTICIPANT_TABS,
        LEAGUE_ADMIN_TAB,
        LEAGUE_INVITES_TAB,
        LEAGUE_SETTINGS_TAB,
      ]
    : [...LEAGUE_PARTICIPANT_TABS];
  return tabs;
}

/** Tab keys shown in the mobile More overflow menu instead of the bottom bar. */
export const MOBILE_MORE_MENU_TAB_KEYS = new Set([
  "rules",
  "admin",
  "invites",
  "settings",
]);

/** Primary mobile bottom nav tabs — overflow keys live in the More menu. */
export function getMobileBottomNavTabs(isAdmin: boolean): LeagueNavTab[] {
  return getLeagueNavTabs(isAdmin).filter((tab) => !MOBILE_MORE_MENU_TAB_KEYS.has(tab.key));
}

export function getMobileMoreMenuTabs(isAdmin: boolean): LeagueNavTab[] {
  return getLeagueNavTabs(isAdmin).filter((tab) => MOBILE_MORE_MENU_TAB_KEYS.has(tab.key));
}

export function isMobileMoreMenuTab(tabKey: string): boolean {
  return MOBILE_MORE_MENU_TAB_KEYS.has(tabKey);
}

export function isHomePath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return path === "/home" || path === "/dashboard" || path === "/dashboard/";
}

/** Static `/leagues/...` segments that are not league ids (create form, etc.). */
const RESERVED_LEAGUE_PATH_SEGMENTS = new Set(["new"]);

/** Reads `/leagues/[leagueId]` from the URL when nav context is not synced yet. */
export function parseLeagueIdFromPathname(pathname: string): string | null {
  const path = pathname.split("?")[0] ?? pathname;
  const match = /^\/leagues\/([^/]+)/.exec(path);
  const segment = match?.[1];
  if (!segment || RESERVED_LEAGUE_PATH_SEGMENTS.has(segment)) {
    return null;
  }
  return segment;
}

/**
 * League id for global nav chrome from the URL. Home always returns null so stale
 * league context cannot keep league tabs mounted after navigating away.
 */
export function resolveAppNavLeagueId(pathname: string): string | null {
  if (isHomePath(pathname)) {
    return null;
  }
  return parseLeagueIdFromPathname(pathname);
}

/**
 * Returns the active tab key for league sub-routes, or `null` when no tab matches
 * (e.g. league hub).
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
