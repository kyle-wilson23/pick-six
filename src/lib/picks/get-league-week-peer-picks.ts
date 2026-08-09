import { LeagueMembershipRole, type PrismaClient } from "@prisma/client";

import { isPickWindowClosedByDeadline } from "@/lib/picks/countdown";
import { userDisplayName } from "@/lib/user-display-name";

export type LeagueWeekPeerPickRow = {
  membershipId: string;
  displayName: string;
  imageUrl: string | null;
  team: { abbreviation: string; name: string } | null;
};

type MembershipRow = {
  id: string;
  user: { name: string | null; email: string; image: string | null };
};

type PickRow = {
  leagueMembershipId: string;
  team: { abbreviation: string; name: string };
};

/**
 * Pure merge for the Opponents' Picks table: all memberships (including viewer),
 * A–Z by display name; `team` null when no pick (UI shows `--`).
 */
export function buildLeagueWeekPeerPickRows(
  memberships: MembershipRow[],
  picks: PickRow[],
): LeagueWeekPeerPickRow[] {
  const picksByMembershipId = new Map<string, PickRow>();
  for (const pick of picks) {
    picksByMembershipId.set(pick.leagueMembershipId, pick);
  }

  const rows: LeagueWeekPeerPickRow[] = memberships.map((membership) => {
    const pick = picksByMembershipId.get(membership.id) ?? null;
    return {
      membershipId: membership.id,
      displayName: userDisplayName(membership.user),
      imageUrl: membership.user.image,
      team: pick
        ? {
            abbreviation: pick.team.abbreviation,
            name: pick.team.name,
          }
        : null,
    };
  });

  rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return rows;
}

/**
 * Whether the picks page may expose peer picks for the viewed week.
 * Preview / missing / unparseable / still-open deadline → locked.
 */
export function isLeagueWeekPeerPicksUnlocked(input: {
  isPreview: boolean;
  pickDeadlineUtc: string | null;
  now: Date;
}): boolean {
  if (input.isPreview) return false;
  return isPickWindowClosedByDeadline(input.pickDeadlineUtc, input.now);
}

/**
 * Deadline-gated peer picks for one league week (picks-page Opponents tab only).
 * Returns `null` when the window is still open / preview / no deadline — never rows.
 */
export async function getLeagueWeekPeerPicks(
  prisma: PrismaClient,
  opts: {
    leagueId: string;
    seasonId: string;
    weekNumber: number;
    isPreview: boolean;
    pickDeadlineUtc: string | null;
    now?: Date;
  },
): Promise<LeagueWeekPeerPickRow[] | null> {
  const now = opts.now ?? new Date();
  if (
    !isLeagueWeekPeerPicksUnlocked({
      isPreview: opts.isPreview,
      pickDeadlineUtc: opts.pickDeadlineUtc,
      now,
    })
  ) {
    return null;
  }

  const [memberships, picks] = await Promise.all([
    prisma.leagueMembership.findMany({
      where: {
        leagueId: opts.leagueId,
        role: { in: [LeagueMembershipRole.ADMIN, LeagueMembershipRole.MEMBER] },
      },
      select: {
        id: true,
        user: { select: { name: true, email: true, image: true } },
      },
    }),
    prisma.pick.findMany({
      where: {
        seasonId: opts.seasonId,
        nflWeekNumber: opts.weekNumber,
        leagueMembership: { leagueId: opts.leagueId },
      },
      select: {
        leagueMembershipId: true,
        team: { select: { abbreviation: true, name: true } },
      },
    }),
  ]);

  return buildLeagueWeekPeerPickRows(memberships, picks);
}
