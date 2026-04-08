import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import {
  hashInviteToken,
  inviteSignupBodySchema,
  isInvitationUsable,
  SIGNUP_PASSWORD_POLICY_MESSAGE,
} from "@/lib/invitations";
import { normalizeEmail } from "@/lib/normalize-email";

const GENERIC_ERROR = {
  error: {
    code: "INVITE_INVALID" as const,
    message: "This invitation link is invalid or has expired.",
  },
};

const PASSWORD_POLICY_ERROR = {
  error: {
    code: "PASSWORD_POLICY" as const,
    message: SIGNUP_PASSWORD_POLICY_MESSAGE,
  },
};

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(GENERIC_ERROR, { status: 400 });
  }

  const parsed = inviteSignupBodySchema.safeParse(json);
  if (!parsed.success) {
    const onlyPassword = parsed.error.issues.every((issue) => issue.path[0] === "password");
    if (onlyPassword) {
      return NextResponse.json(PASSWORD_POLICY_ERROR, { status: 400 });
    }
    return NextResponse.json(GENERIC_ERROR, { status: 400 });
  }

  const { token, password } = parsed.data;
  const tokenHash = hashInviteToken(token);
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { tokenHash },
      });
      if (!invitation) {
        throw new Error("INVITE_BAD");
      }
      if (!isInvitationUsable(invitation, now)) {
        throw new Error("INVITE_BAD");
      }

      const email = normalizeEmail(invitation.invitedEmail);
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        throw new Error("INVITE_BAD");
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await tx.user.create({
        data: {
          email,
          passwordHash,
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { consumedAt: now },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INVITE_BAD") {
      return NextResponse.json(GENERIC_ERROR, { status: 400 });
    }
    console.error("POST /api/signup/invite failed", e);
    return NextResponse.json(GENERIC_ERROR, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
