import "server-only";

const DEFAULT_FROM = `"Pigskin Pick'Em" <noreply@yourdomain.com>`;

/**
 * Resend `from` address for all transactional sends.
 * Override with `RESEND_FROM` in `.env.local` for local smoke tests (e.g. `"Pigskin Pick'Em" <onboarding@resend.dev>`).
 */
export function getResendFrom(): string {
  const override = process.env.RESEND_FROM?.trim();
  return override || DEFAULT_FROM;
}
