/**
 * Optional ops gate for creating test/rehearsal leagues (Story 8.1).
 *
 * - Unset, empty, `true`, or `1` → allow (permissive default for local + rehearsal deploys)
 * - `false` or `0` (trim, case-insensitive) → deny
 *
 * Not a secret — still read only on the server; expose allow/deny to the client as a boolean prop.
 */
export function allowTestLeagues(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  const raw = env.ALLOW_TEST_LEAGUES?.trim();
  if (raw === undefined || raw === "") {
    return true;
  }
  const normalized = raw.toLowerCase();
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  // Unknown values: keep permissive so a typo does not silently lock out rehearsal.
  return true;
}
