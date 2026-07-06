import "server-only";

import { PickOutcome, type PrismaClient } from "@prisma/client";

import { teamNameForExport } from "@/lib/export/team-name-for-export";
import type { PickHistoryOutcome } from "@/lib/scoring/get-personal-pick-history";

const REGULAR_SEASON_WEEKS = 18;

export type LeagueExportParticipant = {
  membershipId: string;
  email: string;
  picksByWeek: Map<
    number,
    {
      exportTeamLabel: string;
      antiJailedBonus: boolean;
      outcome: PickHistoryOutcome;
      pointsEarned: number | null;
    }
  >;
  totalPoints: number;
};

export type LeagueExportJailedWeek = {
  weekNumber: number;
  exportTeamLabel: string;
};

export type LeagueExportData = {
  nflSeasonYear: number;
  exportedAtIso: string;
  participants: LeagueExportParticipant[];
  jailedByWeek: LeagueExportJailedWeek[];
};

function mapPickOutcome(outcome: PickOutcome | null): PickHistoryOutcome {
  if (outcome == null) return "PENDING";
  if (outcome === PickOutcome.WIN) return "WIN";
  if (outcome === PickOutcome.LOSS) return "LOSS";
  return "TIE";
}

function sumScoredPoints(
  picks: Array<{ scoredAt: Date | null; pointsEarned: number | null }>,
): number {
  return picks.reduce((sum, pick) => {
    if (pick.scoredAt == null) return sum;
    return sum + (pick.pointsEarned ?? 0);
  }, 0);
}

export async function buildLeagueExportData(
  prisma: PrismaClient,
  opts: {
    leagueId: string;
    nflSeasonYear: number;
    exportedAtIso?: string;
  },
): Promise<LeagueExportData> {
  const exportedAtIso = opts.exportedAtIso ?? new Date().toISOString();
  const emptyJailedByWeek = Array.from({ length: REGULAR_SEASON_WEEKS }, (_, index) => ({
    weekNumber: index + 1,
    exportTeamLabel: "",
  }));

  const season = await prisma.season.findUnique({
    where: {
      leagueId_nflSeasonYear: {
        leagueId: opts.leagueId,
        nflSeasonYear: opts.nflSeasonYear,
      },
    },
    select: { id: true },
  });

  if (!season) {
    return {
      nflSeasonYear: opts.nflSeasonYear,
      exportedAtIso,
      participants: [],
      jailedByWeek: [],
    };
  }

  const [memberships, picks, jailedRows] = await Promise.all([
    prisma.leagueMembership.findMany({
      where: { leagueId: opts.leagueId },
      select: {
        id: true,
        user: { select: { email: true } },
      },
    }),
    prisma.pick.findMany({
      where: { seasonId: season.id },
      select: {
        leagueMembershipId: true,
        nflWeekNumber: true,
        antiJailedBonus: true,
        outcome: true,
        pointsEarned: true,
        scoredAt: true,
        team: { select: { abbreviation: true, name: true } },
      },
    }),
    prisma.nflWeekJailedTeam.findMany({
      where: {
        nflSeasonYear: opts.nflSeasonYear,
        weekNumber: { gte: 1, lte: REGULAR_SEASON_WEEKS },
      },
      select: {
        weekNumber: true,
        jailedTeam: { select: { abbreviation: true, name: true } },
      },
    }),
  ]);

  const picksByMembership = new Map<string, typeof picks>();
  for (const pick of picks) {
    const list = picksByMembership.get(pick.leagueMembershipId) ?? [];
    list.push(pick);
    picksByMembership.set(pick.leagueMembershipId, list);
  }

  const participants: LeagueExportParticipant[] = memberships.map((membership) => {
    const memberPicks = picksByMembership.get(membership.id) ?? [];
    const picksByWeek = new Map<
      number,
      LeagueExportParticipant["picksByWeek"] extends Map<number, infer V> ? V : never
    >();

    for (const pick of memberPicks) {
      picksByWeek.set(pick.nflWeekNumber, {
        exportTeamLabel: teamNameForExport(pick.team.abbreviation, pick.team.name),
        antiJailedBonus: pick.antiJailedBonus,
        outcome: mapPickOutcome(pick.outcome),
        pointsEarned: pick.outcome == null ? null : (pick.pointsEarned ?? 0),
      });
    }

    return {
      membershipId: membership.id,
      email: membership.user.email,
      picksByWeek,
      totalPoints: sumScoredPoints(memberPicks),
    };
  });

  participants.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.email.localeCompare(b.email, "en");
  });

  const jailedLabelByWeek = new Map<number, string>();
  for (const row of jailedRows) {
    jailedLabelByWeek.set(
      row.weekNumber,
      teamNameForExport(row.jailedTeam.abbreviation, row.jailedTeam.name),
    );
  }

  const jailedByWeek = emptyJailedByWeek.map(({ weekNumber }) => ({
    weekNumber,
    exportTeamLabel: jailedLabelByWeek.get(weekNumber) ?? "",
  }));

  return {
    nflSeasonYear: opts.nflSeasonYear,
    exportedAtIso,
    participants,
    jailedByWeek,
  };
}
