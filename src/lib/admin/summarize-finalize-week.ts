export type FinalizeWeekSummaryInput = {
  weekNumber: number;
  allGamesFinalized: boolean;
  finalCount: number;
  notFinalCount: number;
  scored: number;
  skipped: number;
};

/** Admin-facing sentence after POST `/api/admin/scoring/finalize-week`. */
export function summarizeFinalizeWeekResult(result: FinalizeWeekSummaryInput): string {
  if (!result.allGamesFinalized) {
    return `Week ${result.weekNumber} not scored — ${result.notFinalCount} game(s) still not FINAL (${result.finalCount} final). Standings update only after every game is FINAL or CANCELLED.`;
  }
  return `Week ${result.weekNumber} scored: ${result.scored} pick(s) scored, ${result.skipped} skipped.`;
}
