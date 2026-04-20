/**
 * Map The Odds API `home_team` / `away_team` strings to our `Team.name` values (see `prisma/data/nfl-teams.json`).
 * Extend when the provider renames franchises.
 */
const ALIASES: Record<string, string> = {
  "washington commanders": "Washington Commanders",
  "washington football team": "Washington Commanders",
};

export function canonicalTeamDisplayName(apiName: string): string | null {
  const t = apiName.trim();
  const lower = t.toLowerCase();
  if (ALIASES[lower]) {
    return ALIASES[lower];
  }
  return t;
}
