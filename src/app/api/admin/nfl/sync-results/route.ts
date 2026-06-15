import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { assertAuthorizedForNflOddsOps, isOddsAutomationRequest } from "@/lib/nfl/authorize-odds-admin";
import { syncNflResultsFromApiSports } from "@/lib/nfl/sync-nfl-results";
import { readJsonObject } from "@/lib/request-utils";
const bodySchema = z.object({
  nflSeasonYear: z.coerce.number().int().min(2000).max(2100).optional(),
  weekNumber: z.coerce.number().int().min(1).max(18).optional(),
});

/**
 * POST `/api/admin/nfl/sync-results` — update `NflGame` result fields from API-Sports NFL (Story 5.1).
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

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first?.message ?? "Invalid request body" } },
      { status: 400 },
    );
  }

  const apiKey = process.env.API_SPORTS_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: {
          code: "API_SPORTS_NOT_CONFIGURED",
          message: "API_SPORTS_KEY is not set on the server",
        },
      },
      { status: 503 },
    );
  }

  const nflSeasonYear = parsed.data.nflSeasonYear ?? getCurrentNflSeasonYear();
  const weekNumber = parsed.data.weekNumber;
  const result = await syncNflResultsFromApiSports(prisma, {
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
  });
}
