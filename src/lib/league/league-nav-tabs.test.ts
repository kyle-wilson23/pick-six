import { describe, expect, it } from "vitest";

import {
  buildLeagueTabHref,
  getActiveLeagueTab,
  getLeagueNavTabs,
  LEAGUE_PARTICIPANT_TABS,
} from "./league-nav-tabs";

const LEAGUE_ID = "abc";

describe("buildLeagueTabHref", () => {
  it("builds league tab paths", () => {
    expect(buildLeagueTabHref(LEAGUE_ID, "/picks")).toBe("/leagues/abc/picks");
  });
});

describe("getLeagueNavTabs", () => {
  it("includes admin tab only for admins", () => {
    expect(getLeagueNavTabs(false).map((t) => t.key)).toEqual(
      LEAGUE_PARTICIPANT_TABS.map((t) => t.key),
    );
    expect(getLeagueNavTabs(true).map((t) => t.key)).toEqual([
      "picks",
      "standings",
      "history",
      "results",
      "rules",
      "admin",
    ]);
  });
});

describe("getActiveLeagueTab", () => {
  it.each([
    ["/leagues/abc/picks", "picks"],
    ["/leagues/abc/picks?weekNumber=3", "picks"],
    ["/leagues/abc/standings", "standings"],
    ["/leagues/abc/history", "history"],
    ["/leagues/abc/results", "results"],
    ["/leagues/abc/rules", "rules"],
    ["/leagues/abc/admin", "admin"],
  ] as const)("resolves %s → %s", (pathname, expected) => {
    expect(getActiveLeagueTab(pathname, LEAGUE_ID)).toBe(expected);
  });

  it.each([
    "/leagues/abc",
    "/leagues/abc/",
    "/leagues/abc/settings",
    "/leagues/abc/invites",
    "/leagues/other/picks",
  ] as const)("returns null for %s", (pathname) => {
    expect(getActiveLeagueTab(pathname, LEAGUE_ID)).toBeNull();
  });
});
