import type { StandingsEntry } from "./get-league-standings";

export function rankBiggestLosers(standings: StandingsEntry[]): StandingsEntry[] {
  const sorted = standings.map((entry) => ({ ...entry }));
  sorted.sort((a, b) => {
    if (b.losses !== a.losses) return b.losses - a.losses;
    return a.displayName.localeCompare(b.displayName);
  });

  const ranked: StandingsEntry[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const rank =
      i > 0 && sorted[i].losses === sorted[i - 1].losses ? ranked[i - 1].rank : i + 1;
    ranked.push({ ...sorted[i], rank });
  }
  return ranked;
}
