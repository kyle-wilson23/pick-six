/**
 * POST `/api/leagues/[leagueId]/pre-season-init` — mark current season pre-season initialized (FR3, Story 2.3).
 *
 * - **CSRF / same-origin:** body parsed first, then `assertCookieSessionMutationOrigin`, then `auth()` (NFR15).
 * - **Idempotent:** if `preSeasonInitializedAt` is already set, returns success without changing the timestamp.
 */

import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { preSeasonInitBodySchema } from "@/lib/league/pre-season-init-body";
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

  const parsed = preSeasonInitBodySchema.safeParse(bodyRead.value);
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

  try {
    await prisma.season.updateMany({
      where: { id: season.id, preSeasonInitializedAt: null },
      data: { preSeasonInitializedAt: new Date() },
    });

    const updated = await prisma.season.findUniqueOrThrow({
      where: { id: season.id },
      select: { id: true, preSeasonInitializedAt: true },
    });

    return NextResponse.json({
      seasonId: updated.id,
      preSeasonInitializedAt: updated.preSeasonInitializedAt?.toISOString() ?? null,
    });
  } catch (e) {
    console.error("POST /api/leagues/[leagueId]/pre-season-init failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
