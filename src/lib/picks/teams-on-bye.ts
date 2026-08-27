import { teamPlaysInWeek, type NflGameTeamPair } from "@/lib/domain/picks";
import type { PicksWeekTeamJson } from "@/lib/picks/picks-week-view-types";

/** Typical NFL / fixture cards are 13–16 games; fewer is treated as an incomplete slate. */
export const MIN_COMPLETE_SLATE_GAMES = 13;

export type ByeTeam = PicksWeekTeamJson;

/**
 * Teams in `allTeams` that do not appear in `weekGames`.
 * Returns [] when the slate is empty, incomplete (<13 games), or every catalog team plays.
 */
export function teamsOnBye(allTeams: ByeTeam[], weekGames: NflGameTeamPair[]): ByeTeam[] {
  if (weekGames.length < MIN_COMPLETE_SLATE_GAMES) {
    return [];
  }

  return allTeams
    .filter((team) => !teamPlaysInWeek(team.id, weekGames))
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name, "en");
      if (byName !== 0) return byName;
      return a.abbreviation.localeCompare(b.abbreviation, "en");
    });
}
