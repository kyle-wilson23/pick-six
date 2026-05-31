/**
 * POST `/api/leagues/[leagueId]/admin/picks` — admin override pick on behalf of a participant (Story 4.2).
 *
 * - **Deadline bypass:** admins may submit or change picks at any time, including post-deadline (FR29/FR30).
 * - **CSRF / same-origin:** read JSON first → Zod → `assertCookieSessionMutationOrigin` → `auth()` (NFR15).
 * - **Auth:** league ADMIN role required (NFR16).
 * - **Rate limiting:** not applied here — admin-only, low-frequency override path; proxy rate limits target high-risk public routes.
 */

import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { adminPickBodySchema } from "@/lib/admin/admin-pick-body";
import { submitPickOnBehalf } from "@/lib/admin/submit-pick-on-behalf";
import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";

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

  const parsed = adminPickBodySchema.safeParse(bodyRead.value);
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
  const { targetMembershipId, teamId, nflWeekNumber, antiJailedBonus } = parsed.data;

  const adminMembership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });

  if (!adminMembership || adminMembership.role !== LeagueMembershipRole.ADMIN) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin role required" } },
      { status: 403 },
    );
  }

  let outcome;
  try {
    outcome = await prisma.$transaction(async (tx) => {
      return submitPickOnBehalf(tx, {
        leagueId,
        adminMembershipId: adminMembership.id,
        targetMembershipId,
        teamId,
        nflWeekNumber,
        antiJailedBonus,
      });
    });
  } catch (e) {
    console.error("POST /api/leagues/[leagueId]/admin/picks failed", e);
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
