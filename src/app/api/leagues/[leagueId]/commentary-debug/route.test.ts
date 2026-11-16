import { LeagueMembershipRole, Prisma } from "@prisma/client";
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

function leagueRow() {
  return {
    id: LEAGUE_ID,
    name: "Office",
    isTestLeague: false,
    commentaryEnabled: false,
    commentaryDebug: false,
    commentaryWeeklyCeilingUsd: new Prisma.Decimal(1),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function membership(role: LeagueMembershipRole) {
  return {
    id: "mem-1",
    role,
    userId: "u-1",
    leagueId: LEAGUE_ID,
    league: leagueRow(),
  };
}

function patchRequest(body: string, origin?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (origin !== undefined) {
    headers.set("origin", origin);
  }
  return new NextRequest(`http://localhost:3000/api/leagues/${LEAGUE_ID}/commentary-debug`, {
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

describe("PATCH /api/leagues/[leagueId]/commentary-debug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPERUSER_EMAIL", "ops@example.com");
    mockAuth.mockResolvedValue({ user: { id: "u-1" } });
    mockMembershipFindUnique.mockResolvedValue(membership(LeagueMembershipRole.ADMIN));
    mockUserFindUnique.mockResolvedValue({ email: "admin@example.com" });
    mockLeagueFindUnique.mockResolvedValue(leagueRow());
    mockLeagueUpdate.mockImplementation(async (args: { data: { commentaryDebug: boolean } }) => ({
      commentaryDebug: args.data.commentaryDebug,
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("saves true for the configured superuser and returns the stored boolean", async () => {
    mockUserFindUnique.mockResolvedValue({ email: "ops@example.com" });

    const res = await call(JSON.stringify({ commentaryDebug: true }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ commentaryDebug: true });
    expect(mockLeagueUpdate).toHaveBeenCalledWith({
      where: { id: LEAGUE_ID },
      data: { commentaryDebug: true },
      select: { commentaryDebug: true },
    });
  });

  it("saves false and returns the stored boolean", async () => {
    mockUserFindUnique.mockResolvedValue({ email: "ops@example.com" });

    const res = await call(JSON.stringify({ commentaryDebug: false }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ commentaryDebug: false });
    expect(mockLeagueUpdate).toHaveBeenCalledWith({
      where: { id: LEAGUE_ID },
      data: { commentaryDebug: false },
      select: { commentaryDebug: true },
    });
  });

  it("lets the configured superuser save without a membership", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u-ops" } });
    mockMembershipFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({ email: "ops@example.com" });

    const res = await call(JSON.stringify({ commentaryDebug: true }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ commentaryDebug: true });
    expect(mockLeagueUpdate).toHaveBeenCalledOnce();
  });

  it.each([
    ["a string boolean", { commentaryDebug: "true" }],
    ["an extra key", { commentaryDebug: true, extra: 1 }],
  ])("returns 400 for %s and leaves the flag unchanged", async (_label, body) => {
    mockUserFindUnique.mockResolvedValue({ email: "ops@example.com" });
    const res = await call(JSON.stringify(body));
    expect(res.status).toBe(400);
    const payload = (await res.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(mockLeagueUpdate).not.toHaveBeenCalled();
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("returns 403 for a league admin and leaves the flag unchanged", async () => {
    const res = await call(JSON.stringify({ commentaryDebug: true }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "Superuser access required" },
    });
    expect(mockLeagueUpdate).not.toHaveBeenCalled();
  });

  it("rejects a missing origin before auth", async () => {
    const res = await call(JSON.stringify({ commentaryDebug: true }), null);
    expect(res.status).toBe(403);
    expect(mockLeagueUpdate).not.toHaveBeenCalled();
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("returns 401 when signed out and leaves the flag unchanged", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await call(JSON.stringify({ commentaryDebug: true }));
    expect(res.status).toBe(401);
    expect(mockLeagueUpdate).not.toHaveBeenCalled();
  });
});
