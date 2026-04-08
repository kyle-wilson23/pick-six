import { describe, expect, it } from "vitest";

import { NextRequest } from "next/server";

import { assertCookieSessionMutationOrigin } from "./cookie-session-mutation-csrf";

function req(
  url: string,
  init: ConstructorParameters<typeof NextRequest>[1] & { headers?: Record<string, string> },
) {
  const { headers: h, ...rest } = init;
  const headers = new Headers(h as HeadersInit);
  return new NextRequest(url, { ...rest, headers });
}

describe("assertCookieSessionMutationOrigin", () => {
  it("allows GET without checks", () => {
    const r = req("https://app.example.com/api/x", { method: "GET" });
    expect(assertCookieSessionMutationOrigin(r)).toBeNull();
  });

  it("allows POST with matching Origin", () => {
    const r = req("https://app.example.com/api/x", {
      method: "POST",
      headers: { origin: "https://app.example.com" },
    });
    expect(assertCookieSessionMutationOrigin(r)).toBeNull();
  });

  it("rejects POST with foreign Origin", async () => {
    const r = req("https://app.example.com/api/x", {
      method: "POST",
      headers: { origin: "https://evil.com" },
    });
    const res = assertCookieSessionMutationOrigin(r);
    expect(res?.status).toBe(403);
    const body = res ? await res.json() : null;
    expect(body).toEqual({
      error: { code: "FORBIDDEN", message: "Invalid origin" },
    });
  });

  it("allows POST with matching Referer when Origin absent", () => {
    const r = req("https://app.example.com/api/x", {
      method: "POST",
      headers: { referer: "https://app.example.com/page" },
    });
    expect(assertCookieSessionMutationOrigin(r)).toBeNull();
  });

  it("rejects POST with foreign Referer when Origin absent", () => {
    const r = req("https://app.example.com/api/x", {
      method: "POST",
      headers: { referer: "https://evil.com/page" },
    });
    const res = assertCookieSessionMutationOrigin(r);
    expect(res?.status).toBe(403);
  });

  it("rejects POST with unparseable Referer", () => {
    const r = req("https://app.example.com/api/x", {
      method: "POST",
      headers: { referer: "not a url" },
    });
    const res = assertCookieSessionMutationOrigin(r);
    expect(res?.status).toBe(403);
  });

  it("allows POST when Sec-Fetch-Site is same-origin", () => {
    const r = req("https://app.example.com/api/x", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin" },
    });
    expect(assertCookieSessionMutationOrigin(r)).toBeNull();
  });

  it("allows POST when Sec-Fetch-Site is same-site", () => {
    const r = req("https://app.example.com/api/x", {
      method: "POST",
      headers: { "sec-fetch-site": "same-site" },
    });
    expect(assertCookieSessionMutationOrigin(r)).toBeNull();
  });

  it("rejects POST when Sec-Fetch-Site is cross-site", () => {
    const r = req("https://app.example.com/api/x", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    });
    const res = assertCookieSessionMutationOrigin(r);
    expect(res?.status).toBe(403);
  });

  it("rejects POST with no Origin, Referer, or Sec-Fetch-Site", async () => {
    const r = req("https://app.example.com/api/x", { method: "POST" });
    const res = assertCookieSessionMutationOrigin(r);
    expect(res?.status).toBe(403);
    const body = res ? await res.json() : null;
    expect(body).toEqual({
      error: { code: "FORBIDDEN", message: "Missing origin verification" },
    });
  });
});
