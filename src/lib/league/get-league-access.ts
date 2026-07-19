import type { LeagueMembershipRole } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@/lib/db";

export type LeagueAccess = {
  membership: {
    id: string;
    role: LeagueMembershipRole;
    userId: string;
    leagueId: string;
  };
  league: {
    id: string;
    name: string;
    createdAt: Date;
  };
};

/**
 * Dedupes membership + league lookup within a single RSC request
 * (layout + page both need the same `(userId, leagueId)` pair).
 *
 * Returns `null` when the user is not a member or the league row is missing.
 * Callers still apply participant / admin role checks as before.
 */
export const getLeagueAccess = cache(
  async (userId: string, leagueId: string): Promise<LeagueAccess | null> => {
    const row = await prisma.leagueMembership.findUnique({
      where: { userId_leagueId: { userId, leagueId } },
      select: {
        id: true,
        role: true,
        userId: true,
        leagueId: true,
        league: {
          select: { id: true, name: true, createdAt: true },
        },
      },
    });

    if (!row?.league) {
      return null;
    }

    return {
      membership: {
        id: row.id,
        role: row.role,
        userId: row.userId,
        leagueId: row.leagueId,
      },
      league: row.league,
    };
  },
);
