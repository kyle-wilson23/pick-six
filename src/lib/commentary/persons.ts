import "server-only";

import { prisma } from "@/lib/db";
import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === "P2002";
}

/**
 * Link every current player membership to one league person.
 * Creates a person only when that membership has none. A second call does not create another.
 */
export async function linkLeaguePersons(leagueId: string): Promise<void> {
  const memberships = await prisma.leagueMembership.findMany({
    where: leaguePlayerMembershipWhere(leagueId),
    select: { id: true },
  });

  for (const membership of memberships) {
    const existing = await prisma.leaguePerson.findUnique({
      where: { membershipId: membership.id },
      select: { id: true },
    });
    if (existing) {
      continue;
    }
    try {
      await prisma.leaguePerson.create({
        data: { leagueId, membershipId: membership.id },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }
}
