import type { Prisma } from "@prisma/client";

import { validateDuplicateTeamAcrossSeason, validateJailedLineupAndBonus } from "@/lib/domain/picks";
import { isFirstPickForSeason, isFirstCompetitionWeekEditable } from "@/lib/league/first-competition-week";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { isWeekInLeagueCompetition } from "@/lib/nfl/nfl-regular-season";

export type Tx = Prisma.TransactionClient;

export type SubmitPickOnBehalfErr = { type: "err"; status: number; code: string; message: string };
export type SubmitPickOnBehalfOk = {
  type: "ok";
  status: 200 | 201;
  body: {
    pick: {
      id: string;
      teamId: string;
      nflWeekNumber: number;
      antiJailedBonus: boolean;
      createdAt: string;
      updatedAt: string;
    };
  };
};

function err(status: number, code: string, message: string): SubmitPickOnBehalfErr {
  return { type: "err", status, code, message };
}

/**
 * Admin override pick mutation (Story 4.2). Same validation as participant picks except
 * deadline enforcement is intentionally omitted (FR29/FR30).
 */
export async function submitPickOnBehalf(
  tx: Tx,
  args: {
    leagueId: string;
    adminMembershipId: string;
    targetMembershipId: string;
    teamId: string;
    nflWeekNumber: number;
    antiJailedBonus: boolean;
  },
): Promise<SubmitPickOnBehalfErr | SubmitPickOnBehalfOk> {
  const { leagueId, targetMembershipId, teamId, nflWeekNumber, antiJailedBonus } = args;

  const season = await resolveCurrentSeasonForLeague(tx.season, leagueId);
  if (!season) {
    return err(404, "SEASON_NOT_FOUND", "No season exists for this league and the current NFL season year");
  }

  if (!season.preSeasonInitializedAt) {
    return err(400, "SEASON_NOT_READY", "This season is not ready for picks yet (pre-season not initialized).");
  }

  if (!isWeekInLeagueCompetition(season, nflWeekNumber)) {
    return err(
      400,
      "WEEK_NOT_IN_COMPETITION",
      "That week is not in this league’s competition window (check the first competition week).",
    );
  }

  const targetMembership = await tx.leagueMembership.findFirst({
    where: { id: targetMembershipId, leagueId },
    select: { id: true },
  });
  if (!targetMembership) {
    return err(404, "MEMBER_NOT_FOUND", "Target membership not found in this league");
  }

  const jailed = await tx.nflWeekJailedTeam.findUnique({
    where: {
      nflSeasonYear_weekNumber: {
        nflSeasonYear: season.nflSeasonYear,
        weekNumber: nflWeekNumber,
      },
    },
  });
  if (!jailed) {
    return err(
      400,
      "JAILED_NOT_COMPUTED",
      "Jailed data for this NFL week is not available yet. Run the admin jailed job for this week.",
    );
  }

  const games = await tx.nflGame.findMany({
    where: { nflSeasonYear: season.nflSeasonYear, weekNumber: nflWeekNumber },
    select: { homeTeamId: true, awayTeamId: true, kickoffAt: true },
  });
  if (games.length === 0) {
    return err(
      400,
      "GAMES_NOT_LOADED",
      "No game schedule data is available for this NFL week. Ensure the schedule has been ingested.",
    );
  }
  const gamesWithKickoff: Array<{
    homeTeamId: string;
    awayTeamId: string;
    kickoffAt: Date;
  }> = [];
  for (const g of games) {
    if (g.kickoffAt == null) {
      return err(
        400,
        "GAMES_NOT_LOADED",
        "No game schedule data is available for this NFL week. Ensure the schedule has been ingested.",
      );
    }
    gamesWithKickoff.push({
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      kickoffAt: g.kickoffAt,
    });
  }

  const lineup = validateJailedLineupAndBonus({
    teamId,
    jailedTeamId: jailed.jailedTeamId,
    antiJailedBonus,
    games: gamesWithKickoff,
  });
  if (!lineup.ok) {
    const { code, message } = lineup.error;
    return err(400, code, message);
  }

  const priorSeasonPickCount = await tx.pick.count({
    where: { seasonId: season.id },
  });

  const otherWeekPicks = await tx.pick.findMany({
    where: {
      leagueMembershipId: targetMembershipId,
      seasonId: season.id,
      nflWeekNumber: { not: nflWeekNumber },
    },
    select: { teamId: true },
  });
  const dup = validateDuplicateTeamAcrossSeason(
    teamId,
    otherWeekPicks.map((p) => p.teamId),
  );
  if (!dup.ok) {
    return err(409, dup.error.code, dup.error.message);
  }

  const existing = await tx.pick.findUnique({
    where: {
      leagueMembershipId_seasonId_nflWeekNumber: {
        leagueMembershipId: targetMembershipId,
        seasonId: season.id,
        nflWeekNumber,
      },
    },
    select: { id: true },
  });
  const isCreate = !existing;

  if (isFirstPickForSeason(priorSeasonPickCount) && isFirstCompetitionWeekEditable(season)) {
    await tx.season.updateMany({
      where: { id: season.id, firstCompetitionWeekLockedAt: null },
      data: { firstCompetitionWeekLockedAt: new Date() },
    });
  }

  const saved = await tx.pick.upsert({
    where: {
      leagueMembershipId_seasonId_nflWeekNumber: {
        leagueMembershipId: targetMembershipId,
        seasonId: season.id,
        nflWeekNumber,
      },
    },
    create: {
      seasonId: season.id,
      leagueMembershipId: targetMembershipId,
      teamId,
      nflWeekNumber,
      antiJailedBonus,
    },
    update: {
      teamId,
      antiJailedBonus,
    },
    select: {
      id: true,
      teamId: true,
      nflWeekNumber: true,
      antiJailedBonus: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    type: "ok",
    status: isCreate ? 201 : 200,
    body: {
      pick: {
        id: saved.id,
        teamId: saved.teamId,
        nflWeekNumber: saved.nflWeekNumber,
        antiJailedBonus: saved.antiJailedBonus,
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      },
    },
  };
}
