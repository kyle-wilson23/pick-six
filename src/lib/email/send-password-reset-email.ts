import { createElement } from "react";

import { getAppBaseUrl } from "@/lib/email/app-base-url";
import { getResendFrom } from "@/lib/email/resend-from";
import { resend } from "@/lib/email/resend-client";
import { sendWithRetry } from "@/lib/email/send-with-retry";
import { PasswordResetEmail } from "@/lib/email/templates/PasswordResetEmail";
import { logEvent } from "@/lib/logging/log-event";

export type SendPasswordResetEmailInput = {
  to: string;
  rawToken: string;
  userId: string;
};

/**
 * Sends a password reset email via Resend. Server-only — never called from the client.
 * Failures are logged but not rethrown (fire-and-forget at the API call site).
 */
export async function sendPasswordResetEmail(
  input: SendPasswordResetEmailInput,
): Promise<void> {
  const resetUrl = `${getAppBaseUrl()}/reset-password/${input.rawToken}`;

  try {
    await sendWithRetry(async () => {
      const { data, error } = await resend.emails.send(
        {
          from: getResendFrom(),
          to: [input.to],
          subject: "Reset your Pick Six password",
          react: createElement(PasswordResetEmail, { resetUrl }),
        },
        { idempotencyKey: `password-reset:${input.rawToken}` },
      );

      if (error) {
        throw error;
      }

      return data;
    });

    logEvent({
      level: "info",
      domain: "email",
      action: "password_reset_sent",
      message: "password reset email sent",
      context: {
        userId: input.userId,
      },
    });
  } catch (err) {
    logEvent({
      level: "error",
      domain: "email",
      action: "password_reset_failed",
      message: "password reset email send failed",
      context: {
        userId: input.userId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
