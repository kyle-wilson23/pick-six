/**
 * POST `/api/leagues/[leagueId]/picks` — save or update the caller’s pick for a week (Story 3.4).
 *
 * - **CSRF / same-origin:** read JSON first → Zod → `assertCookieSessionMutationOrigin` → `auth()` (NFR15), matching `pre-season-init`.
 * - **201** first create for that membership+season+week, **200** on update; same body is idempotent.
 * - **Transaction scope:** membership is checked *outside* the transaction as a pre-guard (same pattern as `pre-season-init`;
 *   TOCTOU window on mid-flight membership revocation is accepted). Validation + pick upsert run inside `prisma.$transaction`.
 * - **Story 3.5** — `checkPickMutationDeadline` (single `now` in `runPickMutation`) after games load.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { validateDuplicateTeamAcrossSeason, validateJailedLineupAndBonus } from "@/lib/domain/picks";
import { isFirstPickForSeason, isFirstCompetitionWeekEditable } from "@/lib/league/first-competition-week";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { isWeekInLeagueCompetition } from "@/lib/nfl/nfl-regular-season";
import { checkPickMutationDeadline } from "@/lib/picks/assert-pick-mutation-allowed";
import { postPickBodySchema } from "@/lib/picks/post-pick-body";
import type { Prisma } from "@prisma/client";

async function readJsonObject(
  request: NextRequest,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false };
  }
  if (!text.trim()) {
    return { ok: true, value: {} };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

type Tx = Prisma.TransactionClient;

type RouteErr = { type: "err"; status: number; code: string; message: string };
type RouteOk = {
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

function err(status: number, code: string, message: string): RouteErr {
  return { type: "err", status, code, message };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leagueId: string }> },
) {
  const bodyRead = await readJsonObject(request);
  if (!bodyRead.ok) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const parsed = postPickBodySchema.safeParse(bodyRead.value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: first?.message ?? "Invalid request body",
        },
      },
      { status: 400 },
    );
  }

  const forbidden = assertCookieSessionMutationOrigin(request);
  if (forbidden) {
    return forbidden;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const { leagueId } = await context.params;
  const { teamId, nflWeekNumber, antiJailedBonus } = parsed.data;

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });

  if (!membership || !isLeagueParticipantRole(membership.role)) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "League membership as a participant (admin or member) is required to save picks",
        },
      },
      { status: 403 },
    );
  }

  let outcome: RouteErr | RouteOk;
  try {
    outcome = await prisma.$transaction(async (tx) => {
      return runPickMutation(tx, {
        leagueId,
        leagueMembershipId: membership.id,
        teamId,
        nflWeekNumber,
        antiJailedBonus,
      });
    });
  } catch (e) {
    console.error("POST /api/leagues/[leagueId]/picks failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }

  if (outcome.type === "err") {
    return NextResponse.json(
      { error: { code: outcome.code, message: outcome.message } },
      { status: outcome.status },
    );
  }

  return NextResponse.json(outcome.body, { status: outcome.status });
}

async function runPickMutation(
  tx: Tx,
  args: {
    leagueId: string;
    leagueMembershipId: string;
    teamId: string;
    nflWeekNumber: number;
    antiJailedBonus: boolean;
  },
): Promise<RouteErr | RouteOk> {
  const { leagueId, leagueMembershipId, teamId, nflWeekNumber, antiJailedBonus } = args;
  const now = new Date();

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

  const deadlineBlock = checkPickMutationDeadline({ now, games: gamesWithKickoff });
  if (deadlineBlock) {
    return err(deadlineBlock.status, deadlineBlock.code, deadlineBlock.message);
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
      leagueMembershipId,
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
        leagueMembershipId,
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
        leagueMembershipId,
        seasonId: season.id,
        nflWeekNumber,
      },
    },
    create: {
      seasonId: season.id,
      leagueMembershipId,
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
