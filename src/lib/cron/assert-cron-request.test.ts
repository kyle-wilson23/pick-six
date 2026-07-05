import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { assertCronRequest } from "./assert-cron-request";

function req(authHeader?: string) {
  const headers = authHeader != null ? { authorization: authHeader } : undefined;
  return new NextRequest("http://localhost:3000/api/cron/tuesday-email", {
    method: "POST",
    headers,
  });
}

describe("assertCronRequest", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-secret-value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when CRON_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = assertCronRequest(req("Bearer anything"));
    expect(res?.status).toBe(401);
    const body = res ? await res.json() : null;
    expect(body?.error?.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = assertCronRequest(req());
    expect(res?.status).toBe(401);
    const body = res ? await res.json() : null;
    expect(body).toEqual({
      error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" },
    });
  });

  it("returns 401 when token is wrong", async () => {
    const res = assertCronRequest(req("Bearer wrong-token"));
    expect(res?.status).toBe(401);
    const body = res ? await res.json() : null;
    expect(body?.error?.code).toBe("UNAUTHORIZED");
  });

  it("returns null when token is correct", () => {
    const res = assertCronRequest(req("Bearer test-secret-value"));
    expect(res).toBeNull();
  });

  it("returns 401 when token length differs from secret (no crash)", async () => {
    const res = assertCronRequest(req("Bearer short"));
    expect(res?.status).toBe(401);
    const body = res ? await res.json() : null;
    expect(body?.error?.code).toBe("UNAUTHORIZED");
  });
});
