import { createHash } from "node:crypto";

import { z } from "zod";

import { prisma } from "@/lib/db";

/**
 * Opaque invitation tokens are stored as **SHA-256 hex** of the raw URL token (never store raw).
 * Lookup: `hashInviteToken(presentedToken)` → `Invitation.tokenHash`.
 *
 * We do **not** use `timingSafeEqual` on a stored hash vs computed hash: the client presents a
 * high-entropy token, we hash it once, and load the row by **unique index** on `tokenHash`. Invalid
 * tokens therefore miss the index path; there is no secret string comparison in application code.
 */
export function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/** Cap request body size abuse (seed uses 32 bytes → base64url ≈ 43 chars). */
export const INVITE_TOKEN_MAX_LENGTH = 128;

/** Minimum length; complexity is enforced by `SIGNUP_PASSWORD_REGEX` / `signupPasswordFieldSchema`. */
export const SIGNUP_PASSWORD_MIN_LENGTH = 8;

/** At least one digit and one ASCII special (punctuation/symbol); minimum 8 characters total. */
export const SIGNUP_PASSWORD_REGEX =
  /^(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?/~`]).{8,}$/;

export const SIGNUP_PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include at least one number and one special character.";

export const signupPasswordFieldSchema = z
  .string()
  .regex(SIGNUP_PASSWORD_REGEX, SIGNUP_PASSWORD_POLICY_MESSAGE);

/** POST `/api/signup/invite` JSON body (shared with Route Handler + tests). */
export const inviteSignupBodySchema = z.object({
  token: z.string().min(1).max(INVITE_TOKEN_MAX_LENGTH),
  password: signupPasswordFieldSchema,
});

/** Pure predicate: DB row is present, not consumed, and not past `expiresAt`. */
export function isInvitationUsable(
  invitation: { consumedAt: Date | null; expiresAt: Date } | null,
  now: Date,
): boolean {
  return (
    invitation !== null &&
    invitation.consumedAt === null &&
    invitation.expiresAt > now
  );
}

export type SignupInvitePreview =
  | { status: "invalid" }
  | { status: "valid"; invitedEmail: string };

/** Server-only: resolve invite for signup page (validity for display + form). */
export async function getSignupInvitePreview(rawToken: string): Promise<SignupInvitePreview> {
  const tokenHash = hashInviteToken(rawToken);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
  });
  const now = new Date();
  if (!invitation) {
    return { status: "invalid" };
  }
  if (!isInvitationUsable(invitation, now)) {
    return { status: "invalid" };
  }
  return {
    status: "valid",
    invitedEmail: invitation.invitedEmail,
  };
}
