import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import {
  hashPasswordResetToken,
  resetPasswordBodySchema,
} from "@/lib/password-reset";
import { SIGNUP_PASSWORD_POLICY_MESSAGE } from "@/lib/invitations";

const GENERIC_TOKEN_ERROR = {
  error: {
    code: "INVALID_TOKEN" as const,
    message: "This reset link is invalid or has expired. Request a new password reset link.",
  },
};

const PASSWORD_POLICY_ERROR = {
  error: {
    code: "VALIDATION_ERROR" as const,
    message: SIGNUP_PASSWORD_POLICY_MESSAGE,
  },
};

const INTERNAL_ERROR = {
  error: {
    code: "INTERNAL_ERROR" as const,
    message: "Something went wrong. Please try again.",
  },
};

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(GENERIC_TOKEN_ERROR, { status: 400 });
  }

  const parsed = resetPasswordBodySchema.safeParse(json);
  if (!parsed.success) {
    const onlyPassword = parsed.error.issues.every((issue) => issue.path[0] === "password");
    if (onlyPassword) {
      return NextResponse.json(PASSWORD_POLICY_ERROR, { status: 400 });
    }
    return NextResponse.json(GENERIC_TOKEN_ERROR, { status: 400 });
  }

  const { token, password } = parsed.data;
  const tokenHash = hashPasswordResetToken(token);
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          tokenHash,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        throw new Error("TOKEN_BAD");
      }

      const row = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { userId: true },
      });
      if (!row) {
        throw new Error("TOKEN_BAD");
      }

      await tx.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.updateMany({
        where: { userId: row.userId, consumedAt: null },
        data: { consumedAt: now },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "TOKEN_BAD") {
      return NextResponse.json(GENERIC_TOKEN_ERROR, { status: 400 });
    }
    console.error("POST /api/auth/reset-password unexpected failure", e);
    return NextResponse.json(INTERNAL_ERROR, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
