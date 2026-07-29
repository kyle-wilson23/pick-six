import { prisma } from "@/lib/db";

/**
 * Best-effort stamp of `lastVisitedAt` for the user's league membership (Story 9.5).
 * Fire-and-forget — callers should not await in the render path unless testing.
 */
export async function recordLeagueVisit(userId: string, leagueId: string): Promise<void> {
  await prisma.leagueMembership.updateMany({
    where: { userId, leagueId },
    data: { lastVisitedAt: new Date() },
  });
}
