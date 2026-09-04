import type { LeagueMembershipRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";
import { userDisplayName } from "@/lib/user-display-name";

export type LeagueRosterEntry = {
  membershipId: string;
  role: LeagueMembershipRole;
  displayName: string;
  imageUrl: string | null;
  user: { name: string | null; email: string };
};

/**
 * AC2: **`User.name`** ascending, then **`User.email`** ascending; null names sort after named
 * users (PostgreSQL **NULLS LAST** semantics for the first key).
 */
export function compareLeagueRosterMembers(
  a: { user: { name: string | null; email: string } },
  b: { user: { name: string | null; email: string } },
): number {
  if (a.user.name === null && b.user.name === null) {
    return a.user.email.localeCompare(b.user.email);
  }
  if (a.user.name === null) return 1;
  if (b.user.name === null) return -1;
  const byName = a.user.name.localeCompare(b.user.name);
  if (byName !== 0) return byName;
  return a.user.email.localeCompare(b.user.email);
}

export async function listLeagueRoster(leagueId: string): Promise<LeagueRosterEntry[]> {
  const memberships = await prisma.leagueMembership.findMany({
    where: leaguePlayerMembershipWhere(leagueId),
    include: { user: { select: { name: true, email: true, image: true } } },
  });

  return [...memberships]
    .sort(compareLeagueRosterMembers)
    .map((m) => ({
      membershipId: m.id,
      role: m.role,
      user: { name: m.user.name, email: m.user.email },
      displayName: userDisplayName(m.user),
      imageUrl: m.user.image,
    }));
}
