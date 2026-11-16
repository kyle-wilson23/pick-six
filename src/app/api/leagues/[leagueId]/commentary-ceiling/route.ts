/**
 * PATCH `/api/leagues/[leagueId]/commentary-ceiling` — set `League.commentaryWeeklyCeilingUsd`.
 *
 * Order matches the commentary flag route: parse JSON, Zod, CSRF, `auth()`, then superuser only.
 * A league admin cannot write this column. Saving it does not call a model.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { loadLeagueAccess } from "@/lib/league/get-league-access";
import { patchCommentaryCeilingBodySchema } from "@/lib/league/patch-commentary-ceiling-body";

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

  const parsed = patchCommentaryCeilingBodySchema.safeParse(bodyRead.value);
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

  const access = await loadLeagueAccess(session.user.id, leagueId);
  if (!access?.isSuperuser) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Superuser access required" } },
      { status: 403 },
    );
  }

  try {
    const updated = await prisma.league.update({
      where: { id: leagueId },
      data: { commentaryWeeklyCeilingUsd: parsed.data.commentaryWeeklyCeilingUsd },
      select: { commentaryWeeklyCeilingUsd: true },
    });

    return NextResponse.json({
      commentaryWeeklyCeilingUsd: updated.commentaryWeeklyCeilingUsd.toString(),
    });
  } catch (e) {
    console.error("PATCH /api/leagues/[leagueId]/commentary-ceiling failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
