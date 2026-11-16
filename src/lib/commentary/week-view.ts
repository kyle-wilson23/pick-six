import "server-only";

import type { PickOutcome } from "@prisma/client";

import { prisma } from "@/lib/db";
import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";
import { userDisplayName } from "@/lib/user-display-name";

/** Email and user id stay out of the object the model sees. */
const NON_EMAIL_LABEL = "Player";

function commentaryDisplayName(user: { name?: string | null; email: string }): string {
  const label = userDisplayName(user);
  return label.includes("@") ? NON_EMAIL_LABEL : label;
}

export type CommentaryWeekViewRow = {
  personId: string;
  userDisplayName: string;
  year: number;
  week: number;
  outcome: PickOutcome;
  points: number;
  teamAbbreviation: string | null;
};

function cellKey(personId: string, year: number, week: number): string {
  return `${personId}\u0000${year}\u0000${week}`;
}

/**
 * Scored player picks for every year that has a season, and book rows for every other year.
 * `nflSeasonYear` and `weekNumber` identify the digest. They do not filter this history.
 */
export async function loadCommentaryWeekView(args: {
  leagueId: string;
  nflSeasonYear: number;
  weekNumber: number;
}): Promise<CommentaryWeekViewRow[]> {
  const seasons = await prisma.season.findMany({
    where: { leagueId: args.leagueId },
    select: { nflSeasonYear: true },
  });
  const liveYears = [...new Set(seasons.map((season) => season.nflSeasonYear))].sort(
    (left, right) => left - right,
  );
  const liveYearSet = new Set(liveYears);
  const playerMembership = leaguePlayerMembershipWhere(args.leagueId);

  const [picks, bookRows] = await Promise.all([
    liveYears.length === 0
      ? Promise.resolve([])
      : prisma.pick.findMany({
          where: {
            outcome: { not: null },
            pointsEarned: { not: null },
            season: {
              leagueId: args.leagueId,
              nflSeasonYear: { in: liveYears },
            },
            leagueMembership: playerMembership,
          },
          select: {
            nflWeekNumber: true,
            outcome: true,
            pointsEarned: true,
            team: { select: { abbreviation: true } },
            season: { select: { nflSeasonYear: true } },
            leagueMembership: {
              select: {
                leaguePerson: { select: { id: true } },
                user: { select: { name: true, email: true } },
              },
            },
          },
        }),
    prisma.bookRow.findMany({
      where: {
        leaguePerson: { membership: playerMembership },
        ...(liveYears.length > 0 ? { nflSeasonYear: { notIn: liveYears } } : {}),
      },
      select: {
        nflSeasonYear: true,
        weekNumber: true,
        outcome: true,
        points: true,
        team: { select: { abbreviation: true } },
        leaguePerson: {
          select: {
            id: true,
            membership: {
              select: {
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const byCell = new Map<string, CommentaryWeekViewRow>();
  for (const pick of picks) {
    const personId = pick.leagueMembership.leaguePerson?.id;
    if (personId == null || pick.outcome == null || pick.pointsEarned == null) continue;
    if (!liveYearSet.has(pick.season.nflSeasonYear)) continue;
    const row: CommentaryWeekViewRow = {
      personId,
      userDisplayName: commentaryDisplayName(pick.leagueMembership.user),
      year: pick.season.nflSeasonYear,
      week: pick.nflWeekNumber,
      outcome: pick.outcome,
      points: pick.pointsEarned,
      teamAbbreviation: pick.team.abbreviation,
    };
    const key = cellKey(row.personId, row.year, row.week);
    if (!byCell.has(key)) byCell.set(key, row);
  }
  for (const book of bookRows) {
    if (liveYearSet.has(book.nflSeasonYear)) continue;
    const row: CommentaryWeekViewRow = {
      personId: book.leaguePerson.id,
      userDisplayName: commentaryDisplayName(book.leaguePerson.membership.user),
      year: book.nflSeasonYear,
      week: book.weekNumber,
      outcome: book.outcome,
      points: book.points,
      teamAbbreviation: book.team?.abbreviation ?? null,
    };
    const key = cellKey(row.personId, row.year, row.week);
    if (!byCell.has(key)) byCell.set(key, row);
  }
  return [...byCell.values()];
}
