import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueMembership: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

import { resolveReportLeague } from "./resolve-report-league";

describe("resolveReportLeague", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the path league when the user is a member", async () => {
    mockFindUnique.mockResolvedValue({
      league: { id: "lg-1", name: "Alpha" },
    });
    await expect(
      resolveReportLeague("user-1", "/leagues/lg-1/picks"),
    ).resolves.toEqual({ id: "lg-1", name: "Alpha" });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("falls back to latest lastVisitedAt when not on a league route", async () => {
    mockFindFirst.mockResolvedValue({
      league: { id: "lg-2", name: "Beta" },
    });
    await expect(resolveReportLeague("user-1", "/home")).resolves.toEqual({
      id: "lg-2",
      name: "Beta",
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("falls back to last visited when path league is not a membership", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue({
      league: { id: "lg-3", name: "Gamma" },
    });
    await expect(
      resolveReportLeague("user-1", "/leagues/other/picks"),
    ).resolves.toEqual({ id: "lg-3", name: "Gamma" });
  });

  it("returns null when there is no league", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(resolveReportLeague("user-1", "/profile")).resolves.toBeNull();
  });
});
