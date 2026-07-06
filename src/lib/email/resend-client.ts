import { Resend } from "resend";

import { logEvent } from "@/lib/logging/log-event";

if (!process.env.RESEND_API_KEY?.trim()) {
  logEvent({
    level: "error",
    domain: "email",
    action: "config_missing",
    code: "CONFIG_MISSING",
    message: "RESEND_API_KEY is not configured — set in .env.local or Vercel env vars",
  });
  throw new Error(
    "RESEND_API_KEY is not configured — set in .env.local or Vercel env vars",
  );
}

/** Singleton Resend client — one instance per process (see Story 6.1 AC #6). */
export const resend = new Resend(process.env.RESEND_API_KEY);

// Resend idempotency keys are stored for 24 hours (same key + same payload returns the original response).
// https://resend.com/docs/dashboard/emails/idempotency-keys
