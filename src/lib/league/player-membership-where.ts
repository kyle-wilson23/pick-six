import type { Prisma } from "@prisma/client";

import { configuredSuperuserEmail } from "@/lib/auth/is-superuser";

/**
 * Membership query for player surfaces (roster, standings, emails, submission status).
 * Excludes the configured superuser email when set.
 */
export function leaguePlayerMembershipWhere(
  leagueId: string,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Prisma.LeagueMembershipWhereInput {
  const email = configuredSuperuserEmail(env);
  if (!email) {
    return { leagueId };
  }
  return { leagueId, user: { email: { not: email } } };
}
