/**
 * PATCH `/api/leagues/[leagueId]/first-competition-week` — update `Season.firstCompetitionWeek` (Story 2.7).
 *
 * - **CSRF / same-origin:** JSON parsed first, then `assertCookieSessionMutationOrigin`, then `auth()` (NFR15), matching `pre-season-init`.
 * - **Rate limiting:** `src/proxy.ts` only applies the sign-in sliding window to **POST** on selected paths (including
 *   `pre-season-init`). This **PATCH** is not rate-limited there; abuse is bounded by auth + admin membership.
 */

import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { isFirstCompetitionWeekEditable } from "@/lib/league/first-competition-week";
import { patchFirstCompetitionWeekBodySchema } from "@/lib/league/patch-first-competition-week-body";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";

async function readJsonObject(request: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const text = await request.text();
  if (!text.trim()) {
    return { ok: true, value: {} };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

export async function PATCH(
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

  const parsed = patchFirstCompetitionWeekBodySchema.safeParse(bodyRead.value);
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

  const membership = await prisma.leagueMembership.findUnique({
    where: {
      userId_leagueId: { userId: session.user.id, leagueId },
    },
  });

  if (!membership || membership.role !== LeagueMembershipRole.ADMIN) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required for this league" } },
      { status: 403 },
    );
  }

  const season = await resolveCurrentSeasonForLeague(prisma.season, leagueId);
  if (!season) {
    return NextResponse.json(
      {
        error: {
          code: "SEASON_NOT_FOUND",
          message: "No season exists for this league and the current NFL season year",
        },
      },
      { status: 404 },
    );
  }

  if (!isFirstCompetitionWeekEditable(season)) {
    return NextResponse.json(
      {
        error: {
          code: "FIRST_COMPETITION_WEEK_LOCKED",
          message: "The first competition week is locked for this season and cannot be changed",
        },
      },
      { status: 409 },
    );
  }

  try {
    const updated = await prisma.season.update({
      where: { id: season.id },
      data: { firstCompetitionWeek: parsed.data.firstCompetitionWeek },
      select: {
        firstCompetitionWeek: true,
        firstCompetitionWeekLockedAt: true,
      },
    });

    return NextResponse.json({
      firstCompetitionWeek: updated.firstCompetitionWeek,
      firstCompetitionWeekLockedAt: updated.firstCompetitionWeekLockedAt?.toISOString() ?? null,
    });
  } catch (e) {
    console.error("PATCH /api/leagues/[leagueId]/first-competition-week failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
