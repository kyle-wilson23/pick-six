import "server-only";

const DEFAULT_FROM = "Pick Six <noreply@yourdomain.com>";

/**
 * Resend `from` address for all transactional sends.
 * Override with `RESEND_FROM` in `.env.local` for local smoke tests (e.g. `Pick Six <onboarding@resend.dev>`).
 */
export function getResendFrom(): string {
  const override = process.env.RESEND_FROM?.trim();
  return override || DEFAULT_FROM;
}
