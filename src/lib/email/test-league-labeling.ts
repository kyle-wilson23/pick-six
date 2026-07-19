/** Rehearsal notice for email HTML/plain body (Story 8.1). */
export const TEST_LEAGUE_EMAIL_BODY_NOTICE =
  "This is a test / rehearsal league — practice data only, not your real season.";

/**
 * Build a subject with optional `[TEST]` prefix.
 * Invite-style (no leading bracket): `[TEST] You're invited…`
 * Bracket digests/reminders: `[TEST][League] Week n — …`
 */
export function formatEmailSubject(
  subject: string,
  isTestLeague: boolean,
): string {
  if (!isTestLeague) {
    return subject;
  }
  if (subject.startsWith("[")) {
    return `[TEST]${subject}`;
  }
  return `[TEST] ${subject}`;
}
