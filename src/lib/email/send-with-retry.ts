import {
  emailSendErrorMessage,
  isQuotaExceededError,
} from "@/lib/email/email-send-error";
import { logEvent } from "@/lib/logging/log-event";

export type RetryOptions = {
  /** Retry attempts after the first failure (default 3 → delays ~1s / ~2s / ~4s). */
  maxRetries?: number;
  /** Base delay in ms before the first retry (default 1000). Doubles each attempt. */
  baseDelayMs?: number;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

function retryAfterMs(err: unknown): number | null {
  if (typeof err !== "object" || err === null) {
    return null;
  }
  const value = (err as { retryAfter?: unknown }).retryAfter;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value * 1000;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retries a send function with exponential backoff. Pure — no Resend import (unit-testable).
 * Short-circuits named daily/monthly quota 429s without burning retry slots.
 * Per-second `rate_limit_exceeded` and unlabeled 429s retry like other transients.
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

      if (isQuotaExceededError(err)) {
        logEvent({
          level: "error",
          domain: "email",
          action: "daily_cap_exhausted",
          code: "EMAIL_DAILY_CAP",
          message: "daily cap exhausted — will not retry until midnight UTC reset",
          context: { statusCode: 429 },
        });
        throw err;
      }

      logEvent({
        level: "error",
        domain: "email",
        action: "send_retry_failed",
        message: `attempt ${attempt + 1} failed: ${emailSendErrorMessage(err)}`,
        context: { attempt: attempt + 1 },
      });

      if (attempt >= maxRetries) {
        break;
      }

      const computedBackoff = baseDelayMs * 2 ** attempt;
      const retryAfter = retryAfterMs(err);
      const delayMs =
        retryAfter == null ? computedBackoff : Math.max(retryAfter, computedBackoff);
      await delay(delayMs);
    }
  }

  throw lastError;
}
