export type ScheduleUpsertInput = {
  nflSeasonYear: number;
  weekNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: Date;
};

export type TeamLookup = {
  byAbbrev: Map<string, string>;
  byCanonicalNameLower: Map<string, string>;
};

export function buildTeamLookup(teams: { id: string; abbreviation: string; name: string }[]): TeamLookup {
  const byAbbrev = new Map<string, string>();
  const byCanonicalNameLower = new Map<string, string>();
  for (const t of teams) {
    byAbbrev.set(t.abbreviation.trim().toUpperCase(), t.id);
    byCanonicalNameLower.set(t.name.trim().toLowerCase(), t.id);
  }
  return { byAbbrev, byCanonicalNameLower };
}
