import "server-only";

import { prisma } from "@/lib/db";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";

export async function getActiveLeagueIds(): Promise<string[]> {
  const seasons = await prisma.season.findMany({
    where: {
      nflSeasonYear: getCurrentNflSeasonYear(),
      preSeasonInitializedAt: { not: null },
    },
    select: { leagueId: true },
  });

  return seasons.map((s) => s.leagueId);
}
