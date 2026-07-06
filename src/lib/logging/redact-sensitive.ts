import "server-only";

const TOKEN_KEYS = new Set([
  "token",
  "rawToken",
  "invitationToken",
  "sessionToken",
  "apiKey",
  "secret",
  "password",
  "authorization",
]);

function redactEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) {
    return "[REDACTED]";
  }
  const domain = value.slice(at + 1);
  return `***@${domain}`;
}

function redactValue(key: string, value: unknown): unknown {
  const lowerKey = key.toLowerCase();

  if (typeof value === "string") {
    if (lowerKey === "email" || lowerKey === "to" || value.includes("@")) {
      return redactEmail(value);
    }
    if (TOKEN_KEYS.has(lowerKey) || lowerKey.includes("token") || lowerKey.includes("secret")) {
      return "[REDACTED]";
    }
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      typeof item === "object" && item !== null
        ? redactSensitive(item as Record<string, unknown>)
        : redactValue(String(index), item),
    );
  }

  if (typeof value === "object" && value !== null) {
    return redactSensitive(value as Record<string, unknown>);
  }

  return value;
}

/** Recursively redact emails, tokens, and secrets from log context objects. */
export function redactSensitive(context: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    result[key] = redactValue(key, value);
  }

  return result;
}
