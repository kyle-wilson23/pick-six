/** Pure helper for Epic 8 gating — rehearsal behaviors must no-op/403 when false. */
export function isTestLeagueLeague(league: { isTestLeague: boolean }): boolean {
  return league.isTestLeague === true;
}
