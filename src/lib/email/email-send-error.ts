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

export type Resend429Kind = "daily_quota" | "monthly_quota" | "rate_limit" | "unknown";

function errorName(err: unknown): string {
  if (typeof err === "object" && err !== null && "name" in err) {
    const name = (err as { name: unknown }).name;
    return typeof name === "string" ? name : "";
  }
  return "";
}

function errorMessageLower(err: unknown): string {
  if (err instanceof Error) {
    return err.message.toLowerCase();
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    return typeof message === "string" ? message.toLowerCase() : "";
  }
  return "";
}

function isStatus(err: unknown, statusCode: number): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    (err as { statusCode: unknown }).statusCode === statusCode
  );
}

/**
 * Resend uses HTTP 429 for daily quota, monthly quota, *and* per-second rate limits.
 * Only quota errors should skip retries.
 */
export function classifyResend429(err: unknown): Resend429Kind | null {
  if (!isStatus(err, 429)) {
    return null;
  }

  const name = errorName(err);
  const message = errorMessageLower(err);

  if (
    name === "daily_quota_exceeded" ||
    message.includes("daily email sending quota") ||
    (message.includes("daily") && message.includes("quota"))
  ) {
    return "daily_quota";
  }

  if (
    name === "monthly_quota_exceeded" ||
    message.includes("monthly email sending quota") ||
    (message.includes("monthly") && message.includes("quota"))
  ) {
    return "monthly_quota";
  }

  if (name === "rate_limit_exceeded" || message.includes("per second")) {
    return "rate_limit";
  }

  return "unknown";
}

/** Daily/monthly quota (and unlabeled 429s) will not recover on a 1–4s backoff. */
export function isNonRetryableResendQuota(err: unknown): boolean {
  const kind = classifyResend429(err);
  return kind === "daily_quota" || kind === "monthly_quota" || kind === "unknown";
}
