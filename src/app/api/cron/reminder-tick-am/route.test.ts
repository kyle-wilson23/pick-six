import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRunReminderTick = vi.fn();

vi.mock("@/lib/cron/run-reminder-tick", () => ({
  runReminderTick: (...args: unknown[]) => mockRunReminderTick(...args),
}));

vi.mock("@/lib/logging/log-event", () => ({
  logEvent: vi.fn(),
}));

import { GET, POST } from "./route";

function req(authHeader?: string) {
  const headers = authHeader != null ? { authorization: authHeader } : undefined;
  return new NextRequest("http://localhost:3000/api/cron/reminder-tick-am", {
    method: "POST",
    headers,
  });
}

describe("POST /api/cron/reminder-tick-am", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-secret-value");
    mockRunReminderTick.mockResolvedValue({
      processed: 1,
      sent: 1,
      skippedAlreadySent: 0,
      skippedNoWeek: 0,
      skippedPreview: 0,
      skippedPastDeadline: 0,
      skippedNotDue: 0,
      skippedMissingDeadline: 0,
      failed: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    const res = await POST(req("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(mockRunReminderTick).not.toHaveBeenCalled();
  });

  it("does not gate on an Eastern weekday window", async () => {
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(200);
    expect(mockRunReminderTick).toHaveBeenCalledOnce();
    expect(mockRunReminderTick).toHaveBeenCalledWith({ route: "/api/cron/reminder-tick-am" });
    expect(await res.json()).toMatchObject({ processed: 1, sent: 1, failed: 0 });
  });

  it("returns 500 via cronJobHttpStatus when any league failed", async () => {
    mockRunReminderTick.mockResolvedValue({
      processed: 2,
      sent: 0,
      skippedAlreadySent: 0,
      skippedNoWeek: 0,
      skippedPreview: 0,
      skippedPastDeadline: 0,
      skippedNotDue: 0,
      skippedMissingDeadline: 0,
      failed: 2,
    });
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(500);
  });

  it("GET delegates to POST", async () => {
    const res = await GET(req("Bearer test-secret-value"));
    expect(res.status).toBe(200);
    expect(mockRunReminderTick).toHaveBeenCalledOnce();
  });
});
