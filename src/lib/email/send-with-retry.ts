import {
  classifyResend429,
  emailSendErrorMessage,
  isNonRetryableResendQuota,
} from "@/lib/email/email-send-error";
import { logEvent } from "@/lib/logging/log-event";

export type RetryOptions = {
  /** Retry attempts after the first failure (default 3 → delays ~1s / ~2s / ~4s). */
  maxRetries?: number;
  /** Base delay in ms before the first retry (default 1000). Doubles each attempt. */
  baseDelayMs?: number;
  /** Merged into every failure log (membershipId, leagueId, …). */
  logContext?: Record<string, unknown>;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function failureContext(
  extra: Record<string, unknown>,
  logContext?: Record<string, unknown>,
): Record<string, unknown> {
  return logContext == null ? extra : { ...logContext, ...extra };
}

/**
 * Retries a send function with exponential backoff. Pure — no Resend import (unit-testable).
 * Short-circuits on Resend daily/monthly quota 429s. Per-second `rate_limit_exceeded`
 * 429s still retry — they recover in well under the backoff window.
 */
export async function sendWithRetry<T>(
  sendFn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await sendFn();
    } catch (err) {
      lastError = err;

      if (isNonRetryableResendQuota(err)) {
        const kind = classifyResend429(err);
        const monthly = kind === "monthly_quota";
        logEvent({
          level: "error",
          domain: "email",
          action: monthly ? "monthly_cap_exhausted" : "daily_cap_exhausted",
          code: monthly ? "EMAIL_MONTHLY_CAP" : "EMAIL_DAILY_CAP",
          message: monthly
            ? "monthly quota exhausted — will not retry until the monthly reset"
            : kind === "unknown"
              ? "Resend 429 without quota/rate-limit name — not retrying (treated as quota)"
              : "daily quota exhausted — will not retry until the rolling 24h window resets",
          context: failureContext(
            {
              statusCode: 429,
              quotaKind: kind,
              error: emailSendErrorMessage(err),
            },
            options?.logContext,
          ),
        });
        throw err;
      }

      logEvent({
        level: "error",
        domain: "email",
        action: "send_retry_failed",
        message: `attempt ${attempt + 1} failed: ${emailSendErrorMessage(err)}`,
        context: failureContext({ attempt: attempt + 1 }, options?.logContext),
      });

      if (attempt >= maxRetries) {
        break;
      }

      const delayMs = baseDelayMs * 2 ** attempt;
      await delay(delayMs);
    }
  }

  throw lastError;
}
