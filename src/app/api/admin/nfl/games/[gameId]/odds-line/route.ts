import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { assertAuthorizedForNflOddsOps } from "@/lib/nfl/authorize-odds-admin";
import { parseOddsLinePatchBody } from "@/lib/nfl/parse-odds-line-patch";
import { upsertManualOddsLineForGame } from "@/lib/nfl/snapshot-nfl-week-odds";

function isOddsAutomationRequest(request: NextRequest): boolean {
  const secret = process.env.ODDS_SNAPSHOT_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function readJsonObject(request: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const value: unknown = await request.json();
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

/**
 * PATCH `/api/admin/nfl/games/[gameId]/odds-line` — manual odds entry when the provider fails (NFR26, NFR30).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> },
) {
  if (!isOddsAutomationRequest(request)) {
    const forbidden = assertCookieSessionMutationOrigin(request);
    if (forbidden) {
      return forbidden;
    }
  }

  const session = await auth();
  const authz = await assertAuthorizedForNflOddsOps(request, session?.user?.id);
  if (authz) {
    return authz;
  }

  const { gameId } = await context.params;

  const bodyRead = await readJsonObject(request);
  if (!bodyRead.ok) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const parsed = parseOddsLinePatchBody(bodyRead.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const { runId } = await upsertManualOddsLineForGame(prisma, {
      nflGameId: gameId,
      homeMoneylineAmerican: parsed.data.homeMoneylineAmerican,
      awayMoneylineAmerican: parsed.data.awayMoneylineAmerican,
      homeSpreadPoints: parsed.data.homeSpreadPoints,
    });
    return NextResponse.json({ runId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("not found")) {
      return NextResponse.json(
        { error: { code: "GAME_NOT_FOUND", message: "NFL game not found" } },
        { status: 404 },
      );
    }
    console.error("PATCH /api/admin/nfl/games/[gameId]/odds-line failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
