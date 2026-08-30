import "server-only";

import { prisma } from "@/lib/db";
import { parseLeagueIdFromPathname } from "@/lib/league/league-nav-tabs";

export type ReportLeague = {
  id: string;
  name: string;
};

/**
 * Current path league if the user is a member; otherwise the membership with
 * the latest `lastVisitedAt`. Null when the user has no usable league.
 */
export async function resolveReportLeague(
  userId: string,
  pathname: string,
): Promise<ReportLeague | null> {
  const pathLeagueId = parseLeagueIdFromPathname(pathname);
  if (pathLeagueId) {
    const membership = await prisma.leagueMembership.findUnique({
      where: { userId_leagueId: { userId, leagueId: pathLeagueId } },
      select: { league: { select: { id: true, name: true } } },
    });
    if (membership?.league) {
      return membership.league;
    }
  }

  const latest = await prisma.leagueMembership.findFirst({
    where: { userId, lastVisitedAt: { not: null } },
    orderBy: { lastVisitedAt: "desc" },
    select: { league: { select: { id: true, name: true } } },
  });
  return latest?.league ?? null;
}
