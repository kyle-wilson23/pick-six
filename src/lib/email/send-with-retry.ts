import { logEvent } from "@/lib/logging/log-event";

export type RetryOptions = {
  /** Retry attempts after the first failure (default 3 → delays ~1s / ~2s / ~4s). */
  maxRetries?: number;
  /** Base delay in ms before the first retry (default 1000). Doubles each attempt. */
  baseDelayMs?: number;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

function isDailyCapError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    (err as { statusCode: unknown }).statusCode === 429
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retries a send function with exponential backoff. Pure — no Resend import (unit-testable).
 * Short-circuits on HTTP 429 (daily cap exhausted) without burning retry slots.
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

      if (isDailyCapError(err)) {
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
        message: `attempt ${attempt + 1} failed: ${errorMessage(err)}`,
        context: { attempt: attempt + 1 },
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
