import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { assertAuthorizedForNflOddsOps } from "@/lib/nfl/authorize-odds-admin";
import { readJsonObject } from "@/lib/request-utils";
import { scoreNflWeek } from "@/lib/scoring/score-nfl-week";

function isOddsAutomationRequest(request: NextRequest): boolean {
  const secret = process.env.ODDS_SNAPSHOT_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

const bodySchema = z.object({
  nflSeasonYear: z.coerce.number().int().min(2020).max(2050).optional(),
  weekNumber: z.coerce.number().int().min(1).max(18),
});

/**
 * POST `/api/admin/scoring/score-week` — score picks for a finalized NFL week (Story 5.2).
 * Auth: league admin session or `Authorization: Bearer ODDS_SNAPSHOT_SECRET`.
 */
export async function POST(request: NextRequest) {
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

  const bodyRead = await readJsonObject(request);
  if (!bodyRead.ok) {
    return bodyRead.response;
  }

  const rawBody =
    typeof bodyRead.body === "object" && bodyRead.body !== null && !Array.isArray(bodyRead.body)
      ? bodyRead.body
      : {};

  if (!("weekNumber" in rawBody) || rawBody.weekNumber == null) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "weekNumber is required" } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first?.message ?? "Invalid request body" } },
      { status: 400 },
    );
  }

  const nflSeasonYear = parsed.data.nflSeasonYear ?? getCurrentNflSeasonYear();
  const { weekNumber } = parsed.data;

  const result = await scoreNflWeek(prisma, { nflSeasonYear, weekNumber });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: {
          code: result.code,
          message: result.message,
        },
      },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json({
    nflSeasonYear,
    weekNumber,
    scored: result.scored,
    skipped: result.skipped,
  });
}
