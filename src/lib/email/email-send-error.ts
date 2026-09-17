const QUOTA_EXCEEDED_NAMES = new Set([
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
]);

function resendErrorFields(err: unknown): {
  name?: unknown;
  statusCode?: unknown;
} | null {
  if (typeof err !== "object" || err === null) {
    return null;
  }
  return err as { name?: unknown; statusCode?: unknown };
}

/** Named daily/monthly quota — do not retry; the cap will not lift until reset. */
export function isQuotaExceededError(err: unknown): boolean {
  const fields = resendErrorFields(err);
  return typeof fields?.name === "string" && QUOTA_EXCEEDED_NAMES.has(fields.name);
}

/**
 * Per-second rate limit (or an unlabeled 429). Retry with backoff.
 * Quota names are excluded even when `statusCode` is 429.
 */
export function isRateLimitError(err: unknown): boolean {
  if (isQuotaExceededError(err)) {
    return false;
  }
  const fields = resendErrorFields(err);
  if (fields == null) {
    return false;
  }
  if (fields.name === "rate_limit_exceeded") {
    return true;
  }
  return fields.statusCode === 429;
}

/**
 * Resend's `emails.send` returns `{ error }` as a plain object (`name`, `message`,
 * `statusCode`), not an `Error`. `String(err)` then becomes `[object Object]`.
 */
export function emailSendErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "object" && err !== null) {
    const o = err as { message?: unknown; name?: unknown; statusCode?: unknown };
    const parts: string[] = [];
    if (typeof o.name === "string" && o.name.length > 0) {
      parts.push(o.name);
    }
    if (typeof o.statusCode === "number") {
      parts.push(String(o.statusCode));
    }
    if (typeof o.message === "string" && o.message.length > 0) {
      parts.push(o.message);
    }
    if (parts.length > 0) {
      return parts.join(": ");
    }
  }

  return String(err);
}
