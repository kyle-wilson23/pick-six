import type { PrismaClient } from "@prisma/client";

import { getCurrentNflSeasonYear } from "./nfl-season";

type SeasonDelegate = Pick<PrismaClient["season"], "findUnique">;

/**
 * Loads the `Season` row for `leagueId` and the resolved NFL season year (Story 2.3).
 */
export async function resolveCurrentSeasonForLeague(
  db: SeasonDelegate,
  leagueId: string,
  nflSeasonYear: number = getCurrentNflSeasonYear(),
) {
  return db.findUnique({
    where: { leagueId_nflSeasonYear: { leagueId, nflSeasonYear } },
  });
}
