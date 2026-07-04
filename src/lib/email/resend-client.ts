import { Resend } from "resend";

if (!process.env.RESEND_API_KEY?.trim()) {
  throw new Error(
    "[email] RESEND_API_KEY is not configured — set in .env.local or Vercel env vars",
  );
}

/** Singleton Resend client — one instance per process (see Story 6.1 AC #6). */
export const resend = new Resend(process.env.RESEND_API_KEY);

// Resend idempotency keys are stored for 24 hours (same key + same payload returns the original response).
// https://resend.com/docs/dashboard/emails/idempotency-keys
