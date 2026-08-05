import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/cron/eastern-window", () => ({
  isInEasternWindow: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

vi.mock("@/lib/league/nfl-season", () => ({
  getCurrentNflSeasonYear: vi.fn(() => 2026),
}));

vi.mock("@/lib/logging/log-event", () => ({
  logEvent: vi.fn(),
}));

vi.mock("@/lib/nfl/sync-nfl-schedule-from-odds", () => ({
  syncNflScheduleFromOdds: vi.fn(),
}));

import { isInEasternWindow } from "@/lib/cron/eastern-window";
import { syncNflScheduleFromOdds } from "@/lib/nfl/sync-nfl-schedule-from-odds";
import { GET, POST } from "./route";

const syncMock = vi.mocked(syncNflScheduleFromOdds);
const windowMock = vi.mocked(isInEasternWindow);

function req(authHeader?: string) {
  const headers = authHeader != null ? { authorization: authHeader } : undefined;
  return new NextRequest("http://localhost:3000/api/cron/sync-nfl-schedule", {
    method: "POST",
    headers,
  });
}

describe("POST /api/cron/sync-nfl-schedule", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-secret-value");
    vi.stubEnv("ODDS_API_KEY", "odds-key");
    windowMock.mockReturnValue(true);
    syncMock.mockResolvedValue({ ok: true, upserted: 12, deleted: 0 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("skips outside Eastern window without calling sync", async () => {
    windowMock.mockReturnValue(false);
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "skipped", reason: "outside_window" });
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("returns 503 when ODDS_API_KEY is missing", async () => {
    vi.stubEnv("ODDS_API_KEY", "");
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error?.code).toBe("ODDS_API_NOT_CONFIGURED");
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("calls schedule sync once and returns counts", async () => {
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      nflSeasonYear: 2026,
      upserted: 12,
      deleted: 0,
      provider: "the-odds-api",
    });
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(syncMock).toHaveBeenCalledWith(
      expect.anything(),
      { apiKey: "odds-key", nflSeasonYear: 2026 },
    );
  });

  it("propagates sync lib failures", async () => {
    syncMock.mockResolvedValue({
      ok: false,
      code: "SCHEDULE_MAPPING_ERROR",
      message: "unknown team",
      httpStatus: 422,
    });
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("SCHEDULE_MAPPING_ERROR");
  });

  it("GET delegates to POST", async () => {
    const res = await GET(req("Bearer test-secret-value"));
    expect(res.status).toBe(200);
    expect(syncMock).toHaveBeenCalledTimes(1);
  });
});
