import { describe, expect, it } from "vitest";

import {
  buildLeagueTabHref,
  getActiveLeagueTab,
  getLeagueNavTabs,
  getMobileBottomNavTabs,
  getMobileMoreMenuTabs,
  LEAGUE_PARTICIPANT_TABS,
  parseLeagueIdFromPathname,
  resolveAppNavLeagueId,
} from "./league-nav-tabs";

const LEAGUE_ID = "abc";

describe("buildLeagueTabHref", () => {
  it("builds league tab paths", () => {
    expect(buildLeagueTabHref(LEAGUE_ID, "/picks")).toBe("/leagues/abc/picks");
  });
});

describe("getLeagueNavTabs", () => {
  it("includes admin and settings tabs only for admins", () => {
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
      "invites",
      "settings",
    ]);
  });
});

describe("getMobileBottomNavTabs", () => {
  it("omits overflow tabs from primary mobile bar (they live in More menu)", () => {
    expect(getMobileBottomNavTabs(false).map((t) => t.key)).toEqual([
      "picks",
      "standings",
      "history",
      "results",
    ]);
    expect(getMobileBottomNavTabs(true).map((t) => t.key)).toEqual([
      "picks",
      "standings",
      "history",
      "results",
    ]);
  });
});

describe("getMobileMoreMenuTabs", () => {
  it("includes rules for all league members and admin/settings for admins", () => {
    expect(getMobileMoreMenuTabs(false).map((t) => t.key)).toEqual(["rules"]);
    expect(getMobileMoreMenuTabs(true).map((t) => t.key)).toEqual([
      "rules",
      "admin",
      "invites",
      "settings",
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
    ["/leagues/abc/invites", "invites"],
    ["/leagues/abc/settings", "settings"],
  ] as const)("resolves %s → %s", (pathname, expected) => {
    expect(getActiveLeagueTab(pathname, LEAGUE_ID)).toBe(expected);
  });

  it.each([
    "/leagues/abc",
    "/leagues/abc/",
    "/leagues/other/picks",
  ] as const)("returns null for %s", (pathname) => {
    expect(getActiveLeagueTab(pathname, LEAGUE_ID)).toBeNull();
  });
});

describe("parseLeagueIdFromPathname", () => {
  it.each([
    ["/leagues/abc/standings", "abc"],
    ["/leagues/abc", "abc"],
    ["/leagues/abc?week=1", "abc"],
    ["/leagues/new", null],
    ["/leagues/new/picks", null],
    ["/home", null],
    ["/my-leagues", null],
  ] as const)("parses %s → %s", (pathname, expected) => {
    expect(parseLeagueIdFromPathname(pathname)).toBe(expected);
  });
});

describe("resolveAppNavLeagueId", () => {
  it.each([
    ["/home", null],
    ["/dashboard", null],
    ["/my-leagues", null],
    ["/leagues/abc/picks", "abc"],
  ] as const)("resolves %s → %s", (pathname, expected) => {
    expect(resolveAppNavLeagueId(pathname)).toBe(expected);
  });
});
