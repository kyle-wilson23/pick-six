import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset-email";
import { normalizeEmail } from "@/lib/normalize-email";
import {
  forgotPasswordBodySchema,
  hashPasswordResetToken,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/password-reset";

const SUCCESS = { ok: true as const };

/** Non-existent user id for AC3 timing pad (updateMany matches zero rows). */
const TIMING_PAD_USER_ID = "__password_reset_timing_pad__";

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

  const parsed = forgotPasswordBodySchema.safeParse(json);
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

  const email = normalizeEmail(parsed.data.email);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

  if (!user?.passwordHash) {
    // Comparable supersede-shaped work so wall-clock cost does not trivially leak existence (AC3).
    try {
      await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.updateMany({
          where: {
            userId: TIMING_PAD_USER_ID,
            consumedAt: null,
          },
          data: { consumedAt: now, expiresAt: now },
        });
      });
    } catch (e) {
      console.error("POST /api/auth/forgot-password timing pad failed", e);
    }
    return NextResponse.json(SUCCESS);
  }

  try {
    const rawToken = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${user.id}))
      `;

      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          consumedAt: null,
        },
        data: { consumedAt: now, expiresAt: now },
      });

      const token = randomBytes(32).toString("base64url");
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashPasswordResetToken(token),
          expiresAt,
        },
      });
      return token;
    });

    void sendPasswordResetEmail({
      to: email,
      rawToken,
      userId: user.id,
    });
  } catch (e) {
    console.error("POST /api/auth/forgot-password token creation failed", e);
  }

  return NextResponse.json(SUCCESS);
}
