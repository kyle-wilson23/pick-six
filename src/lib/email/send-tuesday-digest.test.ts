import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLeagueWeekEmailConfigFindUnique = vi.fn();
const mockLeagueWeekEmailConfigUpsert = vi.fn();
const mockResendSend = vi.fn();
const mockGetTestLeagueEmailMode = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueWeekEmailConfig: {
      findUnique: (...args: unknown[]) => mockLeagueWeekEmailConfigFindUnique(...args),
      upsert: (...args: unknown[]) => mockLeagueWeekEmailConfigUpsert(...args),
    },
  },
}));

vi.mock("@/lib/email/resend-client", () => ({
  resend: {
    emails: {
      send: (...args: unknown[]) => mockResendSend(...args),
    },
  },
}));

vi.mock("@/lib/email/resend-from", () => ({
  getResendFrom: () => "test@example.com",
}));

vi.mock("@/lib/email/send-with-retry", () => ({
  sendWithRetry: (fn: () => Promise<void>) => fn(),
}));

vi.mock("@/lib/email/test-league-email-mode", () => ({
  getTestLeagueEmailMode: () => mockGetTestLeagueEmailMode(),
}));

vi.mock("@/lib/logging/log-event", () => ({
  logEvent: vi.fn(),
}));

import { sendTuesdayDigest } from "./send-tuesday-digest";

const LEAGUE_ID = "league-test";
const PRELOADED_DATA = {
  leagueName: "Rehearsal League",
  leagueId: LEAGUE_ID,
  isTestLeague: true,
  nflSeasonYear: 2026,
  weekNumber: 1,
  standings: [],
  jailedTeamName: null,
  jailedTeamAbbreviation: null,
  picksUrl: "http://localhost:3000/leagues/league-test/picks",
  members: [
    {
      membershipId: "mem-1",
      email: "alice@example.com",
      displayName: "Alice",
    },
    {
      membershipId: "mem-2",
      email: "bob@example.com",
      displayName: "Bob",
    },
  ],
};

describe("sendTuesdayDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeagueWeekEmailConfigFindUnique.mockResolvedValue(null);
    mockLeagueWeekEmailConfigUpsert.mockResolvedValue({});
    mockResendSend.mockResolvedValue({ error: null });
  });

  it("suppress mode never calls Resend but still upserts sentAt", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: PRELOADED_DATA,
    });

    expect(mockResendSend).not.toHaveBeenCalled();
    expect(mockLeagueWeekEmailConfigUpsert).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      suppressed: true,
      wouldSendCount: 2,
    });
    expect(result.sentAt).toBeInstanceOf(Date);
  });

  it("suppress mode with zero members skips the upsert and returns sentAt: null", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: { ...PRELOADED_DATA, members: [] },
    });

    expect(mockResendSend).not.toHaveBeenCalled();
    expect(mockLeagueWeekEmailConfigUpsert).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      sentAt: null,
      suppressed: true,
      wouldSendCount: 0,
    });
  });

  it("test league with send mode uses the normal Resend path", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("send");

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: PRELOADED_DATA,
    });

    expect(mockResendSend).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      sent: 2,
      failed: 0,
      suppressed: false,
      wouldSendCount: 0,
    });
    expect(result.sentAt).toBeInstanceOf(Date);
  });

  it("production league always uses the normal Resend path regardless of suppress mode", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: { ...PRELOADED_DATA, isTestLeague: false },
    });

    expect(mockResendSend).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      sent: 2,
      failed: 0,
      suppressed: false,
      wouldSendCount: 0,
    });
  });
});
