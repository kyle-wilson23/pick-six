import { prisma } from "@/lib/db";
import {
  hashPasswordResetToken,
  isPasswordResetUsable,
  PASSWORD_RESET_TOKEN_MAX_LENGTH,
  type PasswordResetPreview,
} from "@/lib/password-reset";

/** Server-only: resolve reset token for reset page (validity for display + form). */
export async function getPasswordResetPreview(rawToken: string): Promise<PasswordResetPreview> {
  if (!rawToken || rawToken.length > PASSWORD_RESET_TOKEN_MAX_LENGTH) {
    return { status: "invalid" };
  }
  const tokenHash = hashPasswordResetToken(rawToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  const now = new Date();
  if (!row || !isPasswordResetUsable(row, now)) {
    return { status: "invalid" };
  }
  return { status: "valid" };
}
