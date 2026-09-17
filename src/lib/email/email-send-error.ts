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
