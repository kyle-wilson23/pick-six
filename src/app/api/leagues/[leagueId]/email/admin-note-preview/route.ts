/**
 * POST `/api/leagues/[leagueId]/email/admin-note-preview` — render the commissioner note HTML.
 * Does not persist the note and does not call Resend.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminNoteLeagueUrl, parseAdminNoteBody } from "@/lib/email/admin-note";
import {
  renderAdminNotePreviewHtml,
  sanitizeHeaderValue,
} from "@/lib/email/render-admin-note-preview";
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
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { name: true, isTestLeague: true },
    });

    if (!league) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "League not found" } },
        { status: 404 },
      );
    }

    const { html, subject } = await renderAdminNotePreviewHtml({
      leagueName: league.name,
      note: parsed.note,
      leagueUrl: adminNoteLeagueUrl(leagueId),
      isTestLeague: league.isTestLeague,
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Email-Subject": sanitizeHeaderValue(subject),
      },
    });
  } catch (e) {
    console.error("POST /api/leagues/[leagueId]/email/admin-note-preview failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
