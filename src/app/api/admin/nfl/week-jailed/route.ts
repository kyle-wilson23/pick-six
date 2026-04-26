import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { assertAuthorizedForNflOddsOps } from "@/lib/nfl/authorize-odds-admin";
import {
  computeAndPersistNflWeekJailed,
  type JailedComputeActor,
} from "@/lib/nfl/jailed-computation";
import { zNflRegularSeasonWeek } from "@/lib/nfl/nfl-regular-season";

function isOddsAutomationRequest(request: NextRequest): boolean {
  const secret = process.env.ODDS_SNAPSHOT_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// Single Zod schema for both `?nflSeasonYear=…&weekNumber=…` query params (GET) and POST body
// — they describe the same `(season, week)` identifier and must not drift.
const weekIdentifierSchema = z.object({
  nflSeasonYear: z.coerce.number().int().min(2000).max(2100),
  weekNumber: zNflRegularSeasonWeek,
});

async function readJsonObject(request: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const value: unknown = await request.json();
    return { ok: true, value };
  } catch (e) {
    console.warn("[admin/nfl/week-jailed] body parse failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false };
  }
}

/**
 * GET `/api/admin/nfl/week-jailed` — read persisted jailed result + audit for a global NFL week.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const authz = await assertAuthorizedForNflOddsOps(request, session?.user?.id);
  if (authz) {
    return authz;
  }

  const sp = request.nextUrl.searchParams;
  const parsed = weekIdentifierSchema.safeParse({
    nflSeasonYear: sp.get("nflSeasonYear"),
    weekNumber: sp.get("weekNumber"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first?.message ?? "Invalid query" } },
      { status: 400 },
    );
  }

  const { nflSeasonYear, weekNumber } = parsed.data;

  const row = await prisma.nflWeekJailedTeam.findUnique({
    where: { nflSeasonYear_weekNumber: { nflSeasonYear, weekNumber } },
    include: {
      jailedTeam: { select: { id: true, abbreviation: true, name: true } },
    },
  });

  if (!row) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "No jailed result recorded for this NFL season week. Run POST to compute it.",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: row.id,
    nflSeasonYear: row.nflSeasonYear,
    weekNumber: row.weekNumber,
    jailedTeam: row.jailedTeam,
    resolvedBy: row.resolvedBy,
    randomSeed: row.randomSeed,
    audit: row.auditJson,
    computedAt: row.computedAt.toISOString(),
    oddsLineSourceNote: row.oddsLineSourceNote,
  });
}

/**
 * POST `/api/admin/nfl/week-jailed` — compute jailed from effective odds and upsert the global week row.
 */
export async function POST(request: NextRequest) {
  const isAutomation = isOddsAutomationRequest(request);
  if (!isAutomation) {
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

  const parsed = weekIdentifierSchema.safeParse(bodyRead.value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first?.message ?? "Invalid request body" } },
      { status: 400 },
    );
  }

  // Prefer the cookie-session identity if present (it is the auditable actor); fall back to the
  // bearer-secret automation path. `assertAuthorizedForNflOddsOps` has already gated us, so at
  // this point we know either a session admin OR a valid bearer secret is present.
  const userId = session?.user?.id;
  const actor: JailedComputeActor = userId
    ? { via: "admin", userId }
    : { via: "automation" };

  const out = await computeAndPersistNflWeekJailed(prisma, parsed.data, actor);
  if (!out.ok) {
    const { code, message, httpStatus } = out.error;
    return NextResponse.json({ error: { code, message } }, { status: httpStatus });
  }

  const { row, result } = out;

  return NextResponse.json({
    id: row.id,
    nflSeasonYear: row.nflSeasonYear,
    weekNumber: row.weekNumber,
    jailedTeam: row.jailedTeam,
    resolvedBy: row.resolvedBy,
    randomSeed: row.randomSeed,
    audit: row.auditJson,
    computedAt: row.computedAt.toISOString(),
    oddsLineSourceNote: row.oddsLineSourceNote,
    resolution: {
      jailedTeamId: result.jailedTeamId,
      resolvedBy: result.resolvedBy,
    },
  });
}
