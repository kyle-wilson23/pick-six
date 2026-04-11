/**
 * POST `/api/leagues` — create league + current NFL season + creator **ADMIN** membership (Story 2.1).
 *
 * - **CSRF / same-origin:** JSON body is parsed first (per AC), then `assertCookieSessionMutationOrigin`.
 * - **Duplicate league name:** globally unique `leagues.name` → **409** `DUPLICATE_LEAGUE_NAME`
 *   (no tenant data in payload).
 */

import { LeagueMembershipRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { createLeagueBodySchema } from "@/lib/league/create-league-body";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";

function isUniqueNameViolation(error: Prisma.PrismaClientKnownRequestError): boolean {
  if (error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("name");
  }
  return typeof target === "string" && target.includes("name");
}

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
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

  const parsed = createLeagueBodySchema.safeParse(json);
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

  const { name, firstCompetitionWeek } = parsed.data;
  const nflSeasonYear = getCurrentNflSeasonYear();

  try {
    const { league, season } = await prisma.$transaction(async (tx) => {
      const leagueRow = await tx.league.create({
        data: { name },
      });
      const seasonRow = await tx.season.create({
        data: {
          leagueId: leagueRow.id,
          nflSeasonYear,
          firstCompetitionWeek,
        },
      });
      await tx.leagueMembership.create({
        data: {
          userId: session.user.id,
          leagueId: leagueRow.id,
          role: LeagueMembershipRole.ADMIN,
        },
      });
      return { league: leagueRow, season: seasonRow };
    });

    return NextResponse.json({
      id: league.id,
      name: league.name,
      season: {
        id: season.id,
        nflSeasonYear: season.nflSeasonYear,
        firstCompetitionWeek: season.firstCompetitionWeek,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && isUniqueNameViolation(e)) {
      return NextResponse.json(
        {
          error: {
            code: "DUPLICATE_LEAGUE_NAME",
            message: "A league with this name already exists",
          },
        },
        { status: 409 },
      );
    }
    console.error("POST /api/leagues failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
