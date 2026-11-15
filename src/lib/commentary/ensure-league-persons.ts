import "server-only";

import { prisma } from "@/lib/db";
import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";

/** Link each current player membership to one league person. A second call creates none. */
export async function ensureLeaguePersons(leagueId: string): Promise<number> {
  const memberships = await prisma.leagueMembership.findMany({
    where: leaguePlayerMembershipWhere(leagueId),
    select: {
      id: true,
      leaguePerson: { select: { id: true } },
    },
  });
  const missing = memberships.filter((membership) => membership.leaguePerson == null);
  if (missing.length === 0) return 0;
  const created = await prisma.leaguePerson.createMany({
    data: missing.map((membership) => ({
      leagueId,
      leagueMembershipId: membership.id,
    })),
  });
  return created.count;
}
