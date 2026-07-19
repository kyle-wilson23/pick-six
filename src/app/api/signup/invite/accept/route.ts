import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  acceptLeagueInvitation,
  InviteAcceptError,
} from "@/lib/accept-league-invitation";
import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { hashInviteToken, INVITE_TOKEN_MAX_LENGTH } from "@/lib/invitations";

const GENERIC_ERROR = {
  error: {
    code: "INVITE_INVALID" as const,
    message: "This invitation link is invalid or has expired.",
  },
};

const EMAIL_MISMATCH_ERROR = {
  error: {
    code: "EMAIL_MISMATCH" as const,
    message: "This invitation was sent to a different email address.",
  },
};

const acceptBodySchema = z.object({
  token: z.string().min(1).max(INVITE_TOKEN_MAX_LENGTH),
});

export async function POST(request: NextRequest) {
  const csrfError = assertCookieSessionMutationOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(GENERIC_ERROR, { status: 400 });
  }

  const parsed = acceptBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_ERROR, { status: 400 });
  }

  try {
    const result = await acceptLeagueInvitation({
      tokenHash: hashInviteToken(parsed.data.token),
      userId: session.user.id,
      userEmail: session.user.email,
    });

    return NextResponse.json({
      ok: true,
      leagueId: result.leagueId,
      leagueName: result.leagueName,
      isTestLeague: result.isTestLeague,
    });
  } catch (e) {
    if (e instanceof InviteAcceptError) {
      if (e.code === "EMAIL_MISMATCH") {
        return NextResponse.json(EMAIL_MISMATCH_ERROR, { status: 403 });
      }
      return NextResponse.json(GENERIC_ERROR, { status: 400 });
    }
    console.error("POST /api/signup/invite/accept unexpected failure", e);
    return NextResponse.json(GENERIC_ERROR, { status: 400 });
  }
}
