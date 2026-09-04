import { LeagueMembershipRole } from "@prisma/client";
import { cache } from "react";

import { isSuperuserEmail, type SuperuserEnv } from "@/lib/auth/is-superuser";
import { prisma } from "@/lib/db";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";

export type LeagueAccessMembership = {
  id: string;
  role: LeagueMembershipRole;
  userId: string;
  leagueId: string;
};

export type LeagueAccessLeague = {
  id: string;
  name: string;
  isTestLeague: boolean;
  createdAt: Date;
};

export type LeagueAccess = {
  /** Null when a superuser is viewing a league they did not join. Never a synthetic id. */
  membership: LeagueAccessMembership | null;
  league: LeagueAccessLeague;
  isSuperuser: boolean;
  isAdmin: boolean;
  isParticipant: boolean;
};

const leagueSelect = {
  id: true,
  name: true,
  isTestLeague: true,
  createdAt: true,
} as const;

/**
 * Pure access flags. `null` when the league is missing, or the user is neither a member nor superuser.
 */
export function resolveLeagueAccess(args: {
  userEmail: string | null | undefined;
  membership: LeagueAccessMembership | null;
  league: LeagueAccessLeague | null;
  env?: SuperuserEnv;
}): LeagueAccess | null {
  const { userEmail, membership, league, env } = args;
  if (!league) {
    return null;
  }
  const isSuperuser = isSuperuserEmail(userEmail, env);
  if (!membership && !isSuperuser) {
    return null;
  }
  const isParticipant =
    membership != null && isLeagueParticipantRole(membership.role) && !isSuperuser;
  const isAdmin = isSuperuser || membership?.role === LeagueMembershipRole.ADMIN;
  return {
    membership,
    league,
    isSuperuser,
    isAdmin,
    isParticipant,
  };
}

export async function loadLeagueAccess(
  userId: string,
  leagueId: string,
  env: SuperuserEnv = process.env as SuperuserEnv,
): Promise<LeagueAccess | null> {
  const [membershipRow, user] = await Promise.all([
    prisma.leagueMembership.findUnique({
      where: { userId_leagueId: { userId, leagueId } },
      select: {
        id: true,
        role: true,
        userId: true,
        leagueId: true,
        league: { select: leagueSelect },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
  ]);

  if (membershipRow?.league) {
    return resolveLeagueAccess({
      userEmail: user?.email,
      membership: {
        id: membershipRow.id,
        role: membershipRow.role,
        userId: membershipRow.userId,
        leagueId: membershipRow.leagueId,
      },
      league: membershipRow.league,
      env,
    });
  }

  if (!isSuperuserEmail(user?.email, env)) {
    return null;
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: leagueSelect,
  });

  return resolveLeagueAccess({
    userEmail: user?.email,
    membership: null,
    league,
    env,
  });
}

/**
 * Dedupes membership + league lookup within a single RSC request
 * (layout + page both need the same `(userId, leagueId)` pair).
 *
 * Returns `null` when the user is not a member (and not superuser) or the league row is missing.
 */
export const getLeagueAccess = cache(loadLeagueAccess);
