import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logEvent } from "./log-event";

describe("logEvent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T22:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("includes required fields on every emit", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logEvent({
      level: "info",
      domain: "email",
      message: "test message",
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.level).toBe("info");
    expect(payload.timestamp).toBe("2026-07-08T22:00:00.000Z");
    expect(payload.domain).toBe("email");
    expect(payload.message).toBe("test message");
  });

  it("routes error level to console.error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logEvent({
      level: "error",
      domain: "cron",
      message: "failure",
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.level).toBe("error");
  });

  it("redacts email addresses in context", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logEvent({
      level: "error",
      domain: "email",
      message: "send failed",
      context: { email: "alice@example.com", membershipId: "mem-1" },
    });

    const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0])) as {
      context: { email: string; membershipId: string };
    };
    expect(payload.context.email).toBe("***@example.com");
    expect(payload.context.membershipId).toBe("mem-1");
  });

  it("timestamp is valid ISO 8601", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logEvent({
      level: "info",
      domain: "api",
      message: "ok",
    });

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0])) as { timestamp: string };
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
  });
});
