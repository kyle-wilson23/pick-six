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

export type PicksWeekViewPayload = {
  weekNumber: number;
  isPreview: boolean;
  pickDeadlineUtc: string | null;
  jailedTeamId: string | null;
  matchups: PicksWeekMatchupJson[];
};
