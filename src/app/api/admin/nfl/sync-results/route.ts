import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { assertAuthorizedForNflOddsOps, isOddsAutomationRequest } from "@/lib/nfl/authorize-odds-admin";
import { syncNflResultsFromOdds } from "@/lib/nfl/sync-nfl-results-from-odds";
import { readJsonObject } from "@/lib/request-utils";

const bodySchema = z.object({
  nflSeasonYear: z.coerce.number().int().min(2000).max(2100).optional(),
  weekNumber: z.coerce.number().int().min(1).max(18).optional(),
});

/**
 * POST `/api/admin/nfl/sync-results` — update `NflGame` result fields from The Odds API `/scores`.
 * Auth: league admin session or `Authorization: Bearer ODDS_SNAPSHOT_SECRET`.
 * Provider lookback is max 3 days (`daysFrom=3`).
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

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first?.message ?? "Invalid request body" } },
      { status: 400 },
    );
  }

  const apiKey = process.env.ODDS_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: {
          code: "ODDS_API_NOT_CONFIGURED",
          message: "ODDS_API_KEY is not set on the server",
        },
      },
      { status: 503 },
    );
  }

  const nflSeasonYear = parsed.data.nflSeasonYear ?? getCurrentNflSeasonYear();
  const weekNumber = parsed.data.weekNumber;
  const result = await syncNflResultsFromOdds(prisma, {
    apiKey,
    nflSeasonYear,
    weekNumber,
  });

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
    weekNumber: weekNumber ?? null,
    synced: result.synced,
    skipped: result.skipped,
    provider: "the-odds-api",
  });
}
