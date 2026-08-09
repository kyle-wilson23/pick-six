/**
 * PATCH `/api/profile/color-mode` — update authenticated user's color mode preference.
 *
 * - **CSRF / same-origin:** `assertCookieSessionMutationOrigin` after JSON parse.
 * - Sets guest cookie so mode survives logout and auth-screen navigation.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  COLOR_MODE_COOKIE_MAX_AGE_SECONDS,
  COLOR_MODE_COOKIE_NAME,
  colorModeToPrisma,
  updateColorModeBodySchema,
} from "@/lib/color-mode";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const parsed = updateColorModeBodySchema.safeParse(json);
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

  const colorMode = parsed.data.colorMode;

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { colorMode: colorModeToPrisma(colorMode) },
      select: { colorMode: true },
    });

    const response = NextResponse.json({
      ok: true,
      colorMode,
    });
    response.cookies.set(COLOR_MODE_COOKIE_NAME, colorMode, {
      path: "/",
      maxAge: COLOR_MODE_COOKIE_MAX_AGE_SECONDS,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (e) {
    console.error("PATCH /api/profile/color-mode unexpected failure", {
      action: "update_color_mode",
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
      { status: 500 },
    );
  }
}
