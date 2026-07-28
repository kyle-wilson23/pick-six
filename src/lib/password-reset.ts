import { z } from "zod";

import {
  hashInviteToken,
  INVITE_TOKEN_MAX_LENGTH,
  signupPasswordFieldSchema,
} from "@/lib/invitations";

/** Reuse invite token hashing — SHA-256 hex of raw URL token. */
export const hashPasswordResetToken = hashInviteToken;

export const PASSWORD_RESET_TOKEN_MAX_LENGTH = INVITE_TOKEN_MAX_LENGTH;

/** Short-lived reset tokens (Story 9.3). */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export const forgotPasswordBodySchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1).max(PASSWORD_RESET_TOKEN_MAX_LENGTH),
  password: signupPasswordFieldSchema,
});

/** Pure predicate: DB row is present, not consumed, and not past `expiresAt`. */
export function isPasswordResetUsable(
  token: { consumedAt: Date | null; expiresAt: Date } | null,
  now: Date,
): boolean {
  return (
    token !== null &&
    token.consumedAt === null &&
    token.expiresAt > now
  );
}

export type PasswordResetPreview =
  | { status: "invalid" }
  | { status: "valid" };
