import "server-only";

import { redactSensitive } from "@/lib/logging/redact-sensitive";

export type LogLevel = "info" | "warn" | "error";

export type LogDomain = "email" | "cron" | "api" | "webhook" | "scoring";

export type LogEventInput = {
  level: LogLevel;
  domain: LogDomain;
  route?: string;
  action?: string;
  userId?: string;
  leagueId?: string;
  weekNumber?: number;
  code?: string;
  message: string;
  context?: Record<string, unknown>;
};

export type LogEvent = LogEventInput & {
  timestamp: string;
};

function emitLog(event: LogEvent): void {
  const payload = JSON.stringify(event);

  switch (event.level) {
    case "info":
      console.info(payload);
      break;
    case "warn":
      console.warn(payload);
      break;
    case "error":
      console.error(payload);
      break;
  }
}

/** Emits one JSON object per line to the appropriate console.* method. */
export function logEvent(input: LogEventInput): void {
  const event: LogEvent = {
    level: input.level,
    timestamp: new Date().toISOString(),
    domain: input.domain,
    message: input.message,
  };

  if (input.route != null) {
    event.route = input.route;
  }
  if (input.action != null) {
    event.action = input.action;
  }
  if (input.userId != null) {
    event.userId = input.userId;
  }
  if (input.leagueId != null) {
    event.leagueId = input.leagueId;
  }
  if (input.weekNumber != null) {
    event.weekNumber = input.weekNumber;
  }
  if (input.code != null) {
    event.code = input.code;
  }
  if (input.context != null) {
    event.context = redactSensitive(input.context);
  }

  emitLog(event);
}
