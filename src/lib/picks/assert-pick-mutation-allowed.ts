/**
 * **Story 3.5** will add deadline and lock checks here. **3.4** leaves this a no-op so the same
 * handler can import one guard as deadlines land.
 */
export function assertPickMutationAllowed(context: {
  seasonId: string;
  leagueId: string;
  nflWeekNumber: number;
}): void {
  void context;
  // Intentionally empty (Story 3.5).
}
