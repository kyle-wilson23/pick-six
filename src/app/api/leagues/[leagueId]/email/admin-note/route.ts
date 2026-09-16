/**
 * POST `/api/leagues/[leagueId]/email/admin-note` — send an on-demand commissioner note.
 *
 * - **CSRF / same-origin:** `assertCookieSessionMutationOrigin` before `auth()` (NFR15).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { parseAdminNoteBody } from "@/lib/email/admin-note";
import { LeagueNotFoundError } from "@/lib/email/get-tuesday-digest-data";
import { sendAdminNote } from "@/lib/email/send-admin-note";
import { forbiddenAdminJson, requireLeagueAdminAccess } from "@/lib/league/require-league-admin";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leagueId: string }> },
) {
  const csrfError = assertCookieSessionMutationOrigin(request);
  if (csrfError) {
    return csrfError;
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

  const parsed = await parseAdminNoteBody(request);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.message } },
      { status: 400 },
    );
  }

  try {
    const result = await sendAdminNote({ leagueId, note: parsed.note });
    return NextResponse.json({
      sent: result.sent,
      failed: result.failed,
      sentAt: result.sentAt?.toISOString() ?? null,
      suppressed: result.suppressed,
      wouldSendCount: result.wouldSendCount,
    });
  } catch (e) {
    if (e instanceof LeagueNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "League not found" } },
        { status: 404 },
      );
    }
    console.error("POST /api/leagues/[leagueId]/email/admin-note failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
