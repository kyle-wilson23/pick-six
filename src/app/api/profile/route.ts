/**
 * PATCH `/api/profile` — update authenticated user's email + first/last name.
 *
 * - **CSRF / same-origin:** `assertCookieSessionMutationOrigin` after JSON parse.
 * - Writes denormalized Auth.js `name` from first + last.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/normalize-email";
import { PROFILE_EMAIL_IN_USE_MESSAGE, updateProfileBodySchema } from "@/lib/profile";
import { isUniqueEmailViolation } from "@/lib/register-user";
import { fullNameFromParts } from "@/lib/user-display-name";

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

  const parsed = updateProfileBodySchema.safeParse(json);
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

  const email = normalizeEmail(parsed.data.email);
  const firstName = parsed.data.firstName;
  const lastName = parsed.data.lastName;
  const name = fullNameFromParts(firstName, lastName);

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { email, firstName, lastName, name },
      select: { email: true, firstName: true, lastName: true, name: true },
    });

    return NextResponse.json({
      ok: true,
      user: {
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        name: updated.name,
      },
    });
  } catch (e) {
    if (isUniqueEmailViolation(e)) {
      return NextResponse.json(
        {
          error: {
            code: "EMAIL_IN_USE",
            message: PROFILE_EMAIL_IN_USE_MESSAGE,
          },
        },
        { status: 409 },
      );
    }
    console.error("PATCH /api/profile unexpected failure", {
      action: "update_profile",
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
      { status: 500 },
    );
  }
}
