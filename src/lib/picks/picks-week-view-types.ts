import type { WeatherData } from "@/lib/integrations/weather/client";

/** Serializable matchup row for picks UI / GET `/api/leagues/[leagueId]/picks` (Story 3.6). */
export type PicksWeekMatchupJson = {
  gameId: string;
  kickoffAt: string;
  homeTeam: { id: string; abbreviation: string; name: string };
  awayTeam: { id: string; abbreviation: string; name: string };
  homeMoneylineAmerican: number | null;
  awayMoneylineAmerican: number | null;
  homeSpreadPoints: number | null;
  weather: WeatherData | null;
};

/**
 * Story 3.7 — the **caller's** saved pick for the active week, if any. Always scoped to the current
 * user's `leagueMembershipId`; never another participant's pick (NFR17 / project context #4).
 */
export type CurrentPickJson = {
  teamId: string;
  antiJailedBonus: boolean;
  /** ISO UTC `updatedAt` for cache busting / "last saved" affordances. */
  updatedAt: string;
};

/**
 * Story 3.7 — teams the caller has saved in **other** weeks of the same season. Drives the
 * "PICKED WK X" already-picked visual + click-blocking on the picks page.
 */
export type SeasonPickedTeamJson = {
  teamId: string;
  weekNumber: number;
};

export type PicksWeekViewPayload = {
  weekNumber: number;
  isPreview: boolean;
  pickDeadlineUtc: string | null;
  jailedTeamId: string | null;
  matchups: PicksWeekMatchupJson[];
  /** Story 3.7 — caller's saved pick for the **current** target week, or `null` if none. */
  currentPick: CurrentPickJson | null;
  /** Story 3.7 — caller's saved picks across **other** weeks of the same season (own data only). */
  seasonPickedTeams: SeasonPickedTeamJson[];
};
