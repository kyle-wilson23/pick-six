import { NextResponse } from "next/server";

import {
  createAccountBodySchema,
  EMAIL_IN_USE_MESSAGE,
} from "@/lib/create-account";
import { SIGNUP_PASSWORD_POLICY_MESSAGE } from "@/lib/invitations";
import { registerUser } from "@/lib/register-user";

const PASSWORD_POLICY_ERROR = {
  error: {
    code: "PASSWORD_POLICY" as const,
    message: SIGNUP_PASSWORD_POLICY_MESSAGE,
  },
};

const EMAIL_IN_USE_ERROR = {
  error: {
    code: "EMAIL_IN_USE" as const,
    message: EMAIL_IN_USE_MESSAGE,
  },
};

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const parsed = createAccountBodySchema.safeParse(json);
  if (!parsed.success) {
    const onlyPassword = parsed.error.issues.every((issue) => issue.path[0] === "password");
    if (onlyPassword) {
      return NextResponse.json(PASSWORD_POLICY_ERROR, { status: 400 });
    }
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

  try {
    const result = await registerUser(parsed.data);
    if (!result.ok) {
      return NextResponse.json(EMAIL_IN_USE_ERROR, { status: 409 });
    }

    console.info("POST /api/auth/register success", {
      action: "register",
      email: result.email,
      userId: result.userId,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/auth/register unexpected failure", {
      action: "register",
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
      { status: 500 },
    );
  }
}
