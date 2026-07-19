/**
 * POST `/api/leagues/[leagueId]/invitations` — admin batch invites (Story 2.2).
 *
 * - **CSRF / same-origin:** JSON parsed first, then `assertCookieSessionMutationOrigin` (NFR15).
 * - **Pending invite supersede:** same `leagueId` + normalized email + `consumedAt` null → mark rows
 *   **consumed** (`consumedAt` + `expiresAt` = now) so only one pending row exists (partial unique index).
 * - **Concurrency:** `pg_advisory_xact_lock` per `(leagueId, email)` inside the transaction.
 */

import { randomBytes } from "node:crypto";

import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { sendInvitationEmail } from "@/lib/email/send-invitation-email";
import { prisma } from "@/lib/db";
import { hashInviteToken } from "@/lib/invitations";
import { createInvitationsBodySchema } from "@/lib/league/create-invitations-body";

/** TTL for new invitations (AC1). */
export const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type CreatedInvite = {
  rawToken: string;
  to: string;
  leagueName: string;
  isTestLeague: boolean;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leagueId: string }> },
) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
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

  const membership = await prisma.leagueMembership.findUnique({
    where: {
      userId_leagueId: { userId: session.user.id, leagueId },
    },
    include: {
      league: { select: { name: true, isTestLeague: true } },
    },
  });

  if (!membership || membership.role !== LeagueMembershipRole.ADMIN) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required for this league" } },
      { status: 403 },
    );
  }

  const parsed = createInvitationsBodySchema.safeParse(json);
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

  const { emails } = parsed.data;
  const leagueName = membership.league.name;
  const isTestLeague = membership.league.isTestLeague;

  const blocked = await prisma.leagueMembership.findMany({
    where: {
      leagueId,
      user: { email: { in: emails } },
    },
    include: { user: { select: { email: true } } },
  });

  if (blocked.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "ALREADY_MEMBER",
          message: "One or more emails already belong to this league",
        },
      },
      { status: 409 },
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);

  try {
    const toSend = await prisma.$transaction(async (tx) => {
      const created: CreatedInvite[] = [];
      for (const email of emails) {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${leagueId}),
            hashtext(${email})
          )
        `;
        await tx.invitation.updateMany({
          where: {
            leagueId,
            invitedEmail: email,
            consumedAt: null,
          },
          data: { consumedAt: now, expiresAt: now },
        });

        const rawToken = randomBytes(32).toString("base64url");
        await tx.invitation.create({
          data: {
            leagueId,
            tokenHash: hashInviteToken(rawToken),
            invitedEmail: email,
            expiresAt,
          },
        });
        created.push({ rawToken, to: email, leagueName, isTestLeague });
      }
      return created;
    });

    for (const row of toSend) {
      sendInvitationEmail({
        to: row.to,
        rawToken: row.rawToken,
        leagueName: row.leagueName,
        isTestLeague: row.isTestLeague,
      });
    }

    return NextResponse.json({ created: toSend.length });
  } catch (e) {
    console.error("POST /api/leagues/[leagueId]/invitations failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
