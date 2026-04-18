/**
 * pg v8 warns when `sslmode` is `require`, `prefer`, or `verify-ca` (they are temporarily
 * treated like `verify-full`). Explicit `verify-full` matches that behavior and silences the
 * warning; see pg-connection-string / pg v9 migration messaging.
 */
export function normalizePgConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");
    if (sslmode === "require" || sslmode === "prefer" || sslmode === "verify-ca") {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
    return connectionString;
  } catch {
    return connectionString;
  }
}
