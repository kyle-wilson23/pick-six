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

vi.mock("@/lib/cron/run-week-close", () => ({
  runWeekClose: vi.fn(),
  firstHardFailure: (result: {
    results?: { ok?: boolean; code?: string; message?: string; httpStatus?: number };
    finalize?: { ok?: boolean; code?: string; message?: string; httpStatus?: number };
    snapshot?: { ok?: boolean; code?: string; message?: string; httpStatus?: number };
    jailed?: { ok?: boolean; code?: string; message?: string; httpStatus?: number };
  }) => {
    for (const step of [result.results, result.finalize, result.snapshot, result.jailed]) {
      if (step && step.ok === false && step.code && step.message && step.httpStatus != null) {
        return {
          ok: false as const,
          code: step.code,
          message: step.message,
          httpStatus: step.httpStatus,
        };
      }
    }
    return null;
  },
}));

import { isInEasternWindow } from "@/lib/cron/eastern-window";
import { runWeekClose } from "@/lib/cron/run-week-close";
import { GET, POST } from "./route";

const windowMock = vi.mocked(isInEasternWindow);
const runMock = vi.mocked(runWeekClose);

function req(authHeader?: string) {
  const headers = authHeader != null ? { authorization: authHeader } : undefined;
  return new NextRequest("http://localhost:3000/api/cron/week-close", {
    method: "POST",
    headers,
  });
}

const happy = {
  ok: true,
  httpStatus: 200,
  nflSeasonYear: 2026,
  openingWeek: 2,
  closedWeek: 1,
  snapshotWeek: 2,
  results: { ok: true as const, synced: 12, skipped: 0 },
  finalize: {
    ok: true as const,
    allGamesFinalized: true,
    finalCount: 16,
    notFinalCount: 0,
    scored: 10,
    skipped: 0,
  },
  snapshot: { ok: true as const, runId: "run-1", matchedGames: 16, totalGamesInWeek: 16 },
  jailed: { ok: true as const, jailedTeamId: "team-kc" },
};

describe("POST /api/cron/week-close", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-secret-value");
    vi.stubEnv("ODDS_API_KEY", "odds-key");
    windowMock.mockReturnValue(true);
    runMock.mockResolvedValue(happy);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    const res = await POST(req("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("skips outside Eastern window without calling orchestrator", async () => {
    windowMock.mockReturnValue(false);
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "skipped", reason: "outside_window" });
    expect(runMock).not.toHaveBeenCalled();
  });

  it("returns 503 when ODDS_API_KEY is missing", async () => {
    vi.stubEnv("ODDS_API_KEY", "");
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error?.code).toBe("ODDS_API_NOT_CONFIGURED");
    expect(runMock).not.toHaveBeenCalled();
  });

  it("delegates to runWeekClose once in window", async () => {
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(200);
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledWith(expect.anything(), {
      apiKey: "odds-key",
      nflSeasonYear: 2026,
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.closedWeek).toBe(1);
  });

  it("GET delegates to POST", async () => {
    const res = await GET(req("Bearer test-secret-value"));
    expect(res.status).toBe(200);
    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it("returns orchestrator httpStatus and step error code on hard failure", async () => {
    runMock.mockResolvedValue({
      ...happy,
      ok: false,
      httpStatus: 422,
      snapshot: {
        ok: false,
        code: "NO_MATCHING_ODDS",
        message: "none matched",
        httpStatus: 422,
      },
      jailed: { skipped: true, reason: "snapshot_failed" },
    });
    const res = await POST(req("Bearer test-secret-value"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("NO_MATCHING_ODDS");
  });
});
