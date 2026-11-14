import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockAccess = vi.fn();
const mockGetTuesdayDigestData = vi.fn();
const mockEmailConfigFindUnique = vi.fn();
const mockCommentaryRunFindUnique = vi.fn();
const mockRunWeeklyCommentary = vi.fn();
const mockGenerateText = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/league/require-league-admin", () => ({
  requireLeagueAdminAccess: () => mockAccess(),
  forbiddenAdminJson: () =>
    Response.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, { status: 403 }),
}));

vi.mock("@/lib/email/get-tuesday-digest-data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email/get-tuesday-digest-data")>(
    "@/lib/email/get-tuesday-digest-data",
  );
  return {
    ...actual,
    getTuesdayDigestData: (...args: unknown[]) => mockGetTuesdayDigestData(...args),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueWeekEmailConfig: {
      findUnique: (...args: unknown[]) => mockEmailConfigFindUnique(...args),
    },
    commentaryRun: {
      findUnique: (...args: unknown[]) => mockCommentaryRunFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/commentary/runner", () => ({
  runWeeklyCommentary: (...args: unknown[]) => mockRunWeeklyCommentary(...args),
}));

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  createGateway: () => () => ({}),
  Output: { array: (spec: unknown) => spec },
}));

import { GET } from "./route";

const LEAGUE_ID = "lg-1";

const digest = {
  leagueName: "Office League",
  leagueId: LEAGUE_ID,
  isTestLeague: false,
  commentaryEnabled: true,
  nflSeasonYear: 2026,
  weekNumber: 4,
  isPreviewWeek: false,
  hasConcludedFirstCompetitionWeek: true,
  pickDeadlineUtc: null,
  standings: [],
  jailedTeamName: "Eagles",
  jailedTeamAbbreviation: "PHI",
  picksUrl: "http://localhost:3000/leagues/lg-1/picks",
  members: [],
};

function call() {
  return GET(new NextRequest(`http://localhost:3000/api/leagues/${LEAGUE_ID}/email/tuesday-preview`), {
    params: Promise.resolve({ leagueId: LEAGUE_ID }),
  });
}

describe("GET tuesday preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockAccess.mockResolvedValue({ isAdmin: true });
    mockGetTuesdayDigestData.mockResolvedValue(digest);
    mockEmailConfigFindUnique.mockResolvedValue({ bodyText: "Commissioner says hello." });
    mockCommentaryRunFindUnique.mockResolvedValue(null);
  });

  it("renders a settled note and does not call the model", async () => {
    mockCommentaryRunFindUnique.mockResolvedValue({
      status: "SETTLED",
      outcomeText: "Alex won the week.",
    });

    const response = await call();
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Weekly note");
    expect(html).toContain("Alex won the week.");
    expect(html).toContain("Commissioner says hello.");
    expect(mockRunWeeklyCommentary).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("omits the section for an abnormal row and when commentary is off", async () => {
    mockCommentaryRunFindUnique.mockResolvedValue({
      status: "ABNORMAL",
      outcomeText: null,
    });

    const abnormal = await (await call()).text();
    expect(abnormal).not.toContain("Weekly note");
    expect(abnormal).not.toContain("Quiet week");

    mockGetTuesdayDigestData.mockResolvedValue({ ...digest, commentaryEnabled: false });
    mockCommentaryRunFindUnique.mockResolvedValue({
      status: "SETTLED",
      outcomeText: "Alex won the week.",
    });

    const off = await (await call()).text();
    expect(off).not.toContain("Weekly note");
    expect(off).not.toContain("Alex won the week.");
    expect(mockRunWeeklyCommentary).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});
