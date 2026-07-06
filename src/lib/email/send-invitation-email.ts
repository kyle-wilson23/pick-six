import { createElement } from 'react';
import { getAppBaseUrl } from '@/lib/email/app-base-url';
import { getResendFrom } from '@/lib/email/resend-from';
import { resend } from '@/lib/email/resend-client';
import { sendWithRetry } from '@/lib/email/send-with-retry';
import { InvitationEmail } from '@/lib/email/templates/InvitationEmail';
import { logEvent } from '@/lib/logging/log-event';

export type SendInvitationEmailInput = {
  to: string;
  rawToken: string;
  leagueName: string;
};

/**
 * Sends a league invitation email via Resend. Server-only — never called from the client.
 * Failures are logged but not rethrown (fire-and-forget at the API call site).
 */
export async function sendInvitationEmail(
  input: SendInvitationEmailInput,
): Promise<void> {
  const signupUrl = `${getAppBaseUrl()}/signup/${input.rawToken}`;

  try {
    await sendWithRetry(async () => {
      const { data, error } = await resend.emails.send(
        {
          from: getResendFrom(),
          to: [input.to],
          subject: `You're invited to join ${input.leagueName} on Pick Six`,
          react: createElement(InvitationEmail, {
            leagueName: input.leagueName,
            signupUrl,
          }),
        },
        { idempotencyKey: `invitation:${input.rawToken}` },
      );

      if (error) {
        throw error;
      }

      return data;
    });

    logEvent({
      level: 'info',
      domain: 'email',
      action: 'invitation_sent',
      message: 'invitation sent',
      context: {
        to: input.to,
        leagueName: input.leagueName,
      },
    });
  } catch (err) {
    logEvent({
      level: 'error',
      domain: 'email',
      action: 'invitation_failed',
      message: 'invitation send failed',
      context: {
        to: input.to,
        leagueName: input.leagueName,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
