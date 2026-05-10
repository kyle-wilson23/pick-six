/**
 * Story 3.7 — pure mappers from Prisma `Pick` rows to the camelCase JSON shape used by the
 * picks GET payload (`currentPick`, `seasonPickedTeams`).
 *
 * Kept separate from `build-league-picks-week-view.ts` so Vitest can cover the mapping without
 * standing up Prisma.
 */

import type { CurrentPickJson, SeasonPickedTeamJson } from "@/lib/picks/picks-week-view-types";

export type CurrentPickRow = {
  teamId: string;
  antiJailedBonus: boolean;
  updatedAt: Date;
};

export function mapCurrentPick(row: CurrentPickRow | null): CurrentPickJson | null {
  if (!row) {
    return null;
  }
  return {
    teamId: row.teamId,
    antiJailedBonus: row.antiJailedBonus,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type SeasonPickedTeamRow = {
  teamId: string;
  nflWeekNumber: number;
};

export function mapSeasonPickedTeams(
  rows: ReadonlyArray<SeasonPickedTeamRow>,
): SeasonPickedTeamJson[] {
  return rows.map((r) => ({ teamId: r.teamId, weekNumber: r.nflWeekNumber }));
}
