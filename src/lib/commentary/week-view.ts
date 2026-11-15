import "server-only";

import type { PickOutcome } from "@prisma/client";

import { prisma } from "@/lib/db";
import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";
import { userDisplayName } from "@/lib/user-display-name";

/** This week only. Email and user id stay out of the object the model sees. */
const NON_EMAIL_LABEL = "Player";

function commentaryDisplayName(user: { name?: string | null; email: string }): string {
  const label = userDisplayName(user);
  return label.includes("@") ? NON_EMAIL_LABEL : label;
}

export type CommentaryWeekViewRow = {
  personId: string;
  userDisplayName: string;
  outcome: PickOutcome;
  points: number;
  teamAbbreviation: string;
};

export async function loadCommentaryWeekView(args: {
  leagueId: string;
  nflSeasonYear: number;
  weekNumber: number;
}): Promise<CommentaryWeekViewRow[]> {
  const picks = await prisma.pick.findMany({
    where: {
      nflWeekNumber: args.weekNumber,
      outcome: { not: null },
      pointsEarned: { not: null },
      season: {
        leagueId: args.leagueId,
        nflSeasonYear: args.nflSeasonYear,
      },
      leagueMembership: leaguePlayerMembershipWhere(args.leagueId),
    },
    select: {
      outcome: true,
      pointsEarned: true,
      team: { select: { abbreviation: true } },
      leagueMembership: {
        select: {
          leaguePerson: { select: { id: true } },
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  const rows: CommentaryWeekViewRow[] = [];
  for (const pick of picks) {
    const personId = pick.leagueMembership.leaguePerson?.id;
    if (personId == null || pick.outcome == null || pick.pointsEarned == null) continue;
    rows.push({
      personId,
      userDisplayName: commentaryDisplayName(pick.leagueMembership.user),
      outcome: pick.outcome,
      points: pick.pointsEarned,
      teamAbbreviation: pick.team.abbreviation,
    });
  }
  return rows;
}
