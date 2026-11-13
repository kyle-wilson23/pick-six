import { LeagueMembershipRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());
const mockMembershipFindUnique = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockLeagueFindUnique = vi.hoisted(() => vi.fn());
const mockLeagueUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueMembership: {
      findUnique: (...args: unknown[]) => mockMembershipFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    league: {
      findUnique: (...args: unknown[]) => mockLeagueFindUnique(...args),
      update: (...args: unknown[]) => mockLeagueUpdate(...args),
    },
  },
}));

import { PATCH } from "./route";

const LEAGUE_ID = "lg-1";

function leagueRow(commentaryEnabled: boolean) {
  return {
    id: LEAGUE_ID,
    name: "Office",
    isTestLeague: false,
    commentaryEnabled,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function membership(role: LeagueMembershipRole, commentaryEnabled = false) {
  return {
    id: "mem-1",
    role,
    userId: "u-1",
    leagueId: LEAGUE_ID,
    league: leagueRow(commentaryEnabled),
  };
}

function patchRequest(body: string, origin?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (origin !== undefined) {
    headers.set("origin", origin);
  }
  return new NextRequest(`http://localhost:3000/api/leagues/${LEAGUE_ID}/commentary`, {
    method: "PATCH",
    headers,
    body,
  });
}

function call(body: string, origin: string | null = "http://localhost:3000") {
  return PATCH(patchRequest(body, origin ?? undefined), {
    params: Promise.resolve({ leagueId: LEAGUE_ID }),
  });
}

describe("PATCH /api/leagues/[leagueId]/commentary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPERUSER_EMAIL", "ops@example.com");
    mockAuth.mockResolvedValue({ user: { id: "u-1" } });
    mockMembershipFindUnique.mockResolvedValue(membership(LeagueMembershipRole.ADMIN));
    mockUserFindUnique.mockResolvedValue({ email: "admin@example.com" });
    mockLeagueUpdate.mockImplementation(async (args: { data: { commentaryEnabled: boolean } }) => ({
      commentaryEnabled: args.data.commentaryEnabled,
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects non-JSON without writing", async () => {
    const res = await call("{");
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" },
    });
    expect(mockLeagueUpdate).not.toHaveBeenCalled();
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("rejects JSON that is not a boolean without writing", async () => {
    const res = await call(JSON.stringify({ commentaryEnabled: "true" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockLeagueUpdate).not.toHaveBeenCalled();
  });

  it("rejects a missing origin before auth", async () => {
    const res = await call(JSON.stringify({ commentaryEnabled: true }), null);
    expect(res.status).toBe(403);
    expect(mockLeagueUpdate).not.toHaveBeenCalled();
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("returns 401 when signed out and leaves the flag unchanged", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await call(JSON.stringify({ commentaryEnabled: true }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: { code: "UNAUTHENTICATED", message: "Sign in required" },
    });
    expect(mockLeagueUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 for a member and leaves the flag unchanged", async () => {
    mockMembershipFindUnique.mockResolvedValue(membership(LeagueMembershipRole.MEMBER));
    const res = await call(JSON.stringify({ commentaryEnabled: true }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "Admin access required for this league" },
    });
    expect(mockLeagueUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 for an unknown league and leaves the flag unchanged", async () => {
    mockMembershipFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({ email: "player@example.com" });
    const res = await call(JSON.stringify({ commentaryEnabled: true }));
    expect(res.status).toBe(403);
    expect(mockLeagueUpdate).not.toHaveBeenCalled();
    expect(mockLeagueFindUnique).not.toHaveBeenCalled();
  });

  it("persists on, then off, and each response is that saved value", async () => {
    const on = await call(JSON.stringify({ commentaryEnabled: true }));
    expect(on.status).toBe(200);
    await expect(on.json()).resolves.toEqual({ commentaryEnabled: true });

    const off = await call(JSON.stringify({ commentaryEnabled: false }));
    expect(off.status).toBe(200);
    await expect(off.json()).resolves.toEqual({ commentaryEnabled: false });

    expect(mockLeagueUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: LEAGUE_ID },
      data: { commentaryEnabled: true },
      select: { commentaryEnabled: true },
    });
    expect(mockLeagueUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: LEAGUE_ID },
      data: { commentaryEnabled: false },
      select: { commentaryEnabled: true },
    });
  });

  it("lets the configured superuser save the flag without a membership", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u-ops" } });
    mockMembershipFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({ email: "ops@example.com" });
    mockLeagueFindUnique.mockResolvedValue(leagueRow(false));

    const res = await call(JSON.stringify({ commentaryEnabled: true }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ commentaryEnabled: true });
    expect(mockLeagueUpdate).toHaveBeenCalledWith({
      where: { id: LEAGUE_ID },
      data: { commentaryEnabled: true },
      select: { commentaryEnabled: true },
    });
  });
});
