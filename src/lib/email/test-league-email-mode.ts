export type TestLeagueEmailMode = "send" | "suppress";

export function getTestLeagueEmailMode(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): TestLeagueEmailMode {
  const raw = env.TEST_LEAGUE_EMAIL_MODE?.trim().toLowerCase();
  return raw === "suppress" ? "suppress" : "send";
}
