import type { Prisma } from "@prisma/client";

import { isSuperuserEmail } from "@/lib/auth/is-superuser";
import {
  deriveAntiJailedBonus,
  validateDuplicateTeamAcrossSeason,
  validateJailedLineupAndBonus,
} from "@/lib/domain/picks";
import { isFirstPickForSeason, isFirstCompetitionWeekEditable } from "@/lib/league/first-competition-week";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { getJailedTeamIdForLeagueWeek } from "@/lib/nfl/league-jailed";
import { isWeekInLeagueCompetition } from "@/lib/nfl/nfl-regular-season";
import { resolveGamesForLeague } from "@/lib/nfl/resolve-games-for-league";

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
    adminMembershipId: string | null;
    adminUserId: string;
    targetMembershipId: string;
    teamId: string;
    nflWeekNumber: number;
    /** Ignored — bonus is derived from teamId vs jailed opponent. Kept for call-site compat. */
    antiJailedBonus?: boolean;
  },
): Promise<SubmitPickOnBehalfErr | SubmitPickOnBehalfOk> {
  const { leagueId, adminMembershipId, adminUserId, targetMembershipId, teamId, nflWeekNumber } = args;

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
    select: { id: true, user: { select: { email: true } } },
  });
  if (!targetMembership) {
    return err(404, "MEMBER_NOT_FOUND", "Target membership not found in this league");
  }
  if (isSuperuserEmail(targetMembership.user.email)) {
    return err(403, "FORBIDDEN", "That member cannot receive picks");
  }

  const leagueRow = await tx.league.findUnique({
    where: { id: leagueId },
    select: { isTestLeague: true },
  });
  const isTestLeague = leagueRow?.isTestLeague ?? false;

  const jailedTeamId = await getJailedTeamIdForLeagueWeek(tx, {
    leagueId,
    nflSeasonYear: season.nflSeasonYear,
    weekNumber: nflWeekNumber,
    isTestLeague,
  });
  if (!jailedTeamId) {
    return err(
      400,
      "JAILED_NOT_COMPUTED",
      "Jailed data for this NFL week is not available yet. Run the admin jailed job for this week.",
    );
  }

  const games = await resolveGamesForLeague(tx, {
    leagueId,
    nflSeasonYear: season.nflSeasonYear,
    weekNumber: nflWeekNumber,
    isTestLeague,
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

  const antiJailedBonus = deriveAntiJailedBonus(teamId, jailedTeamId, gamesWithKickoff);

  const lineup = validateJailedLineupAndBonus({
    teamId,
    jailedTeamId,
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
    select: { id: true, teamId: true, antiJailedBonus: true },
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

  // Story 4.3: immutable audit log in same transaction (NFR14, NFR50). No update/delete API exists.
  await tx.auditLogEntry.create({
    data: {
      leagueId,
      adminMembershipId,
      adminUserId,
      targetMembershipId,
      nflWeekNumber,
      beforeTeamId: existing?.teamId ?? null,
      afterTeamId: teamId,
      beforeAntiJailed: existing?.antiJailedBonus ?? null,
      afterAntiJailed: antiJailedBonus,
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
