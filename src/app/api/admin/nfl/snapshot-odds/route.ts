import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { zNflRegularSeasonWeek } from "@/lib/nfl/nfl-regular-season";
import { assertAuthorizedForNflOddsOps } from "@/lib/nfl/authorize-odds-admin";
import { snapshotNflWeekOddsFromProvider } from "@/lib/nfl/snapshot-nfl-week-odds";

function isOddsAutomationRequest(request: NextRequest): boolean {
  const secret = process.env.ODDS_SNAPSHOT_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

const bodySchema = z.object({
  nflSeasonYear: z.coerce.number().int().min(2000).max(2100),
  weekNumber: zNflRegularSeasonWeek,
});

async function readJsonObject(request: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const value: unknown = await request.json();
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

/**
 * POST `/api/admin/nfl/snapshot-odds` — fetch NFL moneyline + spread from The Odds API and persist a snapshot for the week.
 * **Mid-week:** no automatic re-fetch; callers trigger explicitly (Tuesday cadence / manual until Epic 6 cron).
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
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(bodyRead.value);
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

  const result = await snapshotNflWeekOddsFromProvider(prisma, {
    ...parsed.data,
    apiKey,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: {
          code: result.code,
          message: result.message,
        },
        runId: result.runId,
      },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json({
    runId: result.runId,
    matchedGames: result.matchedGames,
    totalGamesInWeek: result.totalGamesInWeek,
  });
}
