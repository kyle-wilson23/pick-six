/**
 * POST `/api/leagues/[leagueId]/invitations` — admin batch invites (Story 2.2).
 *
 * - **CSRF / same-origin:** JSON parsed first, then `assertCookieSessionMutationOrigin` (NFR15).
 * - **Pending invite supersede:** same `leagueId` + normalized email + `consumedAt` null → mark rows
 *   **consumed** (`consumedAt` + `expiresAt` = now) so only one pending row exists (partial unique index).
 * - **Concurrency:** `pg_advisory_xact_lock` per `(leagueId, email)` inside the transaction.
 */

import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isSuperuserEmail } from "@/lib/auth/is-superuser";
import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { EMAIL_SEND_CONCURRENCY, mapWithConcurrency } from "@/lib/email/map-with-concurrency";
import { sendInvitationEmail } from "@/lib/email/send-invitation-email";
import { prisma } from "@/lib/db";
import { hashInviteToken } from "@/lib/invitations";
import { createInvitationsBodySchema } from "@/lib/league/create-invitations-body";
import { forbiddenAdminJson, requireLeagueAdminAccess } from "@/lib/league/require-league-admin";

/** TTL for new invitations (AC1). */
export const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Keep the isolate alive while Resend calls finish (Hobby ceiling). */
export const maxDuration = 300;

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

  const access = await requireLeagueAdminAccess(session.user.id, leagueId);
  if (!access) {
    return forbiddenAdminJson();
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
  if (emails.some((email) => isSuperuserEmail(email))) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "One or more emails cannot be invited to this league",
        },
      },
      { status: 403 },
    );
  }
  const leagueName = access.league.name;
  const isTestLeague = access.league.isTestLeague;

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

    const sendResults = await mapWithConcurrency(
      toSend,
      EMAIL_SEND_CONCURRENCY,
      (row) =>
        sendInvitationEmail({
          to: row.to,
          rawToken: row.rawToken,
          leagueName: row.leagueName,
          isTestLeague: row.isTestLeague,
        }),
    );
    const sent = sendResults.filter(Boolean).length;

    return NextResponse.json({
      created: toSend.length,
      sent,
      failed: toSend.length - sent,
    });
  } catch (e) {
    console.error("POST /api/leagues/[leagueId]/invitations failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
