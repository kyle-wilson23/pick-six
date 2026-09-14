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

vi.mock("@/lib/nfl/sync-nfl-results-from-odds", () => ({
  syncNflResultsFromOdds: vi.fn(),
}));

vi.mock("@/lib/cron/run-week-close", () => ({
  finalizeClosedWeekAfterResultsSync: vi.fn(),
}));

import { isInEasternWindow } from "@/lib/cron/eastern-window";
import { finalizeClosedWeekAfterResultsSync } from "@/lib/cron/run-week-close";
import { syncNflResultsFromOdds } from "@/lib/nfl/sync-nfl-results-from-odds";
import { GET, POST } from "./route";

const syncMock = vi.mocked(syncNflResultsFromOdds);
const finalizeCatchUpMock = vi.mocked(finalizeClosedWeekAfterResultsSync);
const windowMock = vi.mocked(isInEasternWindow);

function req(authHeader?: string) {
  const headers = authHeader != null ? { authorization: authHeader } : undefined;
  return new NextRequest("http://localhost:3000/api/cron/sync-nfl-results", {
    method: "POST",
    headers,
  });
}

describe("POST /api/cron/sync-nfl-results", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-secret-value");
    vi.stubEnv("ODDS_API_KEY", "odds-key");
    windowMock.mockReturnValue(true);
    syncMock.mockResolvedValue({ ok: true, synced: 8, skipped: 1 });
    finalizeCatchUpMock.mockResolvedValue({
      closedWeek: 1,
      finalize: {
        ok: true,
        allGamesFinalized: true,
        finalCount: 16,
        notFinalCount: 0,
        scored: 10,
        skipped: 0,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    const res = await POST(req("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(syncMock).not.toHaveBeenCalled();
    expect(finalizeCatchUpMock).not.toHaveBeenCalled();
  });

  it("skips outside Eastern window without calling sync", async () => {
    windowMock.mockReturnValue(false);
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "skipped", reason: "outside_window" });
    expect(syncMock).not.toHaveBeenCalled();
    expect(finalizeCatchUpMock).not.toHaveBeenCalled();
  });

  it("returns 503 when ODDS_API_KEY is missing", async () => {
    vi.stubEnv("ODDS_API_KEY", "");
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error?.code).toBe("ODDS_API_NOT_CONFIGURED");
    expect(syncMock).not.toHaveBeenCalled();
    expect(finalizeCatchUpMock).not.toHaveBeenCalled();
  });

  it("calls results sync once without weekNumber, then finalize catch-up", async () => {
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      nflSeasonYear: 2026,
      weekNumber: null,
      synced: 8,
      skipped: 1,
      provider: "the-odds-api",
      closedWeek: 1,
      finalize: {
        ok: true,
        allGamesFinalized: true,
        finalCount: 16,
        notFinalCount: 0,
        scored: 10,
        skipped: 0,
      },
    });
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(syncMock).toHaveBeenCalledWith(expect.anything(), {
      apiKey: "odds-key",
      nflSeasonYear: 2026,
    });
    expect(finalizeCatchUpMock).toHaveBeenCalledTimes(1);
    expect(finalizeCatchUpMock).toHaveBeenCalledWith(expect.anything(), 2026);
  });

  it("propagates sync lib failures without finalize", async () => {
    syncMock.mockResolvedValue({
      ok: false,
      code: "ODDS_API_ERROR",
      message: "upstream down",
      httpStatus: 502,
    });
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error?.code).toBe("ODDS_API_ERROR");
    expect(finalizeCatchUpMock).not.toHaveBeenCalled();
  });

  it("GET delegates to POST", async () => {
    const res = await GET(req("Bearer test-secret-value"));
    expect(res.status).toBe(200);
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(finalizeCatchUpMock).toHaveBeenCalledTimes(1);
  });

  it("propagates finalize catch-up failures after ok sync", async () => {
    finalizeCatchUpMock.mockResolvedValue({
      closedWeek: 1,
      finalize: {
        ok: false,
        code: "FINALIZE_ERROR",
        message: "scoring exploded",
        httpStatus: 500,
      },
    });
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error?.code).toBe("FINALIZE_ERROR");
    expect(syncMock).toHaveBeenCalledTimes(1);
  });
});
