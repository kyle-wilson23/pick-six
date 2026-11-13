/**
 * PATCH `/api/leagues/[leagueId]/commentary` — set `League.commentaryEnabled` (Story 10.1).
 *
 * Order matches `first-competition-week`: parse JSON, Zod, CSRF, `auth()`, admin gate.
 * Saving the flag does not call a model or change the Tuesday digest.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { patchCommentaryEnabledBodySchema } from "@/lib/league/patch-commentary-enabled-body";
import { forbiddenAdminJson, requireLeagueAdminAccess } from "@/lib/league/require-league-admin";

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

  const parsed = patchCommentaryEnabledBodySchema.safeParse(bodyRead.value);
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

  const access = await requireLeagueAdminAccess(session.user.id, leagueId);
  if (!access) {
    return forbiddenAdminJson();
  }

  try {
    const updated = await prisma.league.update({
      where: { id: leagueId },
      data: { commentaryEnabled: parsed.data.commentaryEnabled },
      select: { commentaryEnabled: true },
    });

    return NextResponse.json({ commentaryEnabled: updated.commentaryEnabled });
  } catch (e) {
    console.error("PATCH /api/leagues/[leagueId]/commentary failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
