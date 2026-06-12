import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { NflGameStatus } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { assertAuthorizedForNflOddsOps } from "@/lib/nfl/authorize-odds-admin";

const patchSchema = z
  .object({
    homeScore: z.number().int().min(0).optional(),
    awayScore: z.number().int().min(0).optional(),
    status: z.enum(["SCHEDULED", "IN_PROGRESS", "FINAL", "CANCELLED"]),
  })
  .refine((d) => d.status !== "FINAL" || (d.homeScore != null && d.awayScore != null), {
    message: "homeScore and awayScore are required when status is FINAL",
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
 * PATCH `/api/admin/nfl/games/[gameId]/result` — manual game result override (Story 5.1).
 * Auth: league admin session only (no bearer automation bypass).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> },
) {
  if (request.headers.get("authorization")?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      { error: { code: "BEARER_NOT_ACCEPTED", message: "Manual result overrides require an admin session" } },
      { status: 403 },
    );
  }

  const forbidden = assertCookieSessionMutationOrigin(request);
  if (forbidden) {
    return forbidden;
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

  const parsed = patchSchema.safeParse(bodyRead.value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first?.message ?? "Invalid request body" } },
      { status: 400 },
    );
  }

  const existing = await prisma.nflGame.findUnique({
    where: { id: gameId },
    select: { id: true, status: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: { code: "GAME_NOT_FOUND", message: "NFL game not found" } },
      { status: 404 },
    );
  }

  const { status, homeScore, awayScore } = parsed.data;
  const newStatus = status as NflGameStatus;

  const data: {
    status: NflGameStatus;
    homeScore?: number | null;
    awayScore?: number | null;
    finalizedAt?: Date;
  } = { status: newStatus };

  if (newStatus === "CANCELLED") {
    data.homeScore = null;
    data.awayScore = null;
    data.finalizedAt = null;
  } else {
    if (homeScore !== undefined) data.homeScore = homeScore;
    if (awayScore !== undefined) data.awayScore = awayScore;

    if (existing.status === "FINAL" && newStatus !== "FINAL") {
      data.finalizedAt = null;
    } else if (existing.status !== "FINAL" && newStatus === "FINAL") {
      data.finalizedAt = new Date();
    }
  }

  const updated = await prisma.nflGame.update({
    where: { id: gameId },
    data,
    select: {
      id: true,
      nflSeasonYear: true,
      weekNumber: true,
      homeTeamId: true,
      awayTeamId: true,
      status: true,
      homeScore: true,
      awayScore: true,
      finalizedAt: true,
      kickoffAt: true,
    },
  });

  return NextResponse.json(updated);
}
