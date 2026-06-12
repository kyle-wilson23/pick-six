export type GameWinnerResult =
  | { kind: "win"; winnerId: string; loserId: string }
  | { kind: "tie"; teamIds: [string, string] };

/**
 * Determines the winner of a FINAL game. Caller must gate on FINAL status before calling.
 */
export function getGameWinner(game: {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}): GameWinnerResult {
  const { homeTeamId, awayTeamId, homeScore, awayScore } = game;
  if (homeScore == null || awayScore == null) {
    throw new Error("getGameWinner requires non-null scores");
  }
  if (homeScore > awayScore) {
    return { kind: "win", winnerId: homeTeamId, loserId: awayTeamId };
  }
  if (awayScore > homeScore) {
    return { kind: "win", winnerId: awayTeamId, loserId: homeTeamId };
  }
  return { kind: "tie", teamIds: [homeTeamId, awayTeamId] };
}
