import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockAccess = vi.fn();
const mockGetTuesdayDigestData = vi.fn();
const mockConfigFindUnique = vi.fn();
const mockCommentaryRunFindUnique = vi.fn();
const mockRunCommentary = vi.fn();
const mockGenerateText = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/league/require-league-admin", () => ({
  requireLeagueAdminAccess: (...args: unknown[]) => mockAccess(...args),
  forbiddenAdminJson: () =>
    new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
}));

vi.mock("@/lib/email/get-tuesday-digest-data", () => ({
  getTuesdayDigestData: (...args: unknown[]) => mockGetTuesdayDigestData(...args),
  NoActiveWeekError: class NoActiveWeekError extends Error {},
  LeagueNotFoundError: class LeagueNotFoundError extends Error {},
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueWeekEmailConfig: {
      findUnique: (...args: unknown[]) => mockConfigFindUnique(...args),
    },
    commentaryRun: {
      findUnique: (...args: unknown[]) => mockCommentaryRunFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/commentary/run-commentary", () => ({
  runCommentary: (...args: unknown[]) => mockRunCommentary(...args),
}));

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  Output: { object: (value: unknown) => value },
}));

import { GET } from "./route";

const LEAGUE_ID = "league-1";

function digestData() {
  return {
    leagueName: "Office League",
    leagueId: LEAGUE_ID,
    isTestLeague: false,
    nflSeasonYear: 2026,
    weekNumber: 4,
    isPreviewWeek: false,
    hasConcludedFirstCompetitionWeek: true,
    pickDeadlineUtc: null,
    standings: [],
    jailedTeamName: "Eagles",
    jailedTeamAbbreviation: "PHI",
    picksUrl: "https://example.test/leagues/league-1/picks",
    members: [],
    commentaryDebug: false,
  };
}

describe("GET tuesday preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockAccess.mockResolvedValue({ isAdmin: true });
    mockGetTuesdayDigestData.mockResolvedValue(digestData());
    mockConfigFindUnique.mockResolvedValue({ bodyText: "Bring snacks" });
  });

  it("shows a stored proved line and does not call the model", async () => {
    mockCommentaryRunFindUnique.mockResolvedValue({
      status: "COMPLETED",
      sentences: ["Alice took Buffalo for two."],
    });

    const response = await GET(new NextRequest("http://localhost/preview"), {
      params: Promise.resolve({ leagueId: LEAGUE_ID }),
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Alice took Buffalo for two.");
    expect(html.indexOf("Alice took Buffalo for two.")).toBeLessThan(html.indexOf("Make your picks"));
    expect(mockRunCommentary).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("omits the stored note when debug is on and does not call the model", async () => {
    mockGetTuesdayDigestData.mockResolvedValue({ ...digestData(), commentaryDebug: true });
    mockCommentaryRunFindUnique.mockResolvedValue({
      status: "COMPLETED",
      sentences: ["Alice took Buffalo for two.", "Quiet week. Nothing new for the record book."],
    });

    const response = await GET(new NextRequest("http://localhost/preview"), {
      params: Promise.resolve({ leagueId: LEAGUE_ID }),
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(mockCommentaryRunFindUnique).toHaveBeenCalled();
    expect(html).toContain("Standings");
    expect(html).toContain("Jailed team");
    expect(html).not.toContain("This week");
    expect(html).not.toContain("Alice took Buffalo for two.");
    expect(html).not.toContain("Quiet week. Nothing new for the record book.");
    expect(mockRunCommentary).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("shows the stored quiet line and does not call the model", async () => {
    mockCommentaryRunFindUnique.mockResolvedValue({
      status: "COMPLETED",
      sentences: ["Quiet week. Nothing new for the record book."],
    });

    const response = await GET(new NextRequest("http://localhost/preview"), {
      params: Promise.resolve({ leagueId: LEAGUE_ID }),
    });

    expect(await response.text()).toContain("Quiet week. Nothing new for the record book.");
    expect(mockRunCommentary).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("omits a stopped run", async () => {
    mockCommentaryRunFindUnique.mockResolvedValue({
      status: "STOPPED",
      sentences: ["Alice took Buffalo for two."],
    });

    const response = await GET(new NextRequest("http://localhost/preview"), {
      params: Promise.resolve({ leagueId: LEAGUE_ID }),
    });
    const html = await response.text();

    expect(html).not.toContain("Alice took Buffalo for two.");
    expect(html).not.toContain("Quiet week. Nothing new for the record book.");
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});
