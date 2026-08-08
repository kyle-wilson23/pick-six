import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLeagueWeekEmailConfigUpsert = vi.fn();
const mockResendSend = vi.fn();
const mockGetTestLeagueEmailMode = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueWeekEmailConfig: {
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

import { sendReminder } from "./send-reminder";

const LEAGUE_ID = "league-test";
const PRELOADED_DATA = {
  leagueName: "Rehearsal League",
  leagueId: LEAGUE_ID,
  isTestLeague: true,
  nflSeasonYear: 2026,
  weekNumber: 1,
  isPreviewWeek: false,
  jailedTeamName: null,
  jailedTeamAbbreviation: null,
  picksUrl: "http://localhost:3000/leagues/league-test/picks",
  outstandingMembers: [
    {
      membershipId: "mem-1",
      email: "alice@example.com",
      displayName: "Alice",
    },
  ],
  submittedCount: 1,
};

describe("sendReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeagueWeekEmailConfigUpsert.mockResolvedValue({});
    mockResendSend.mockResolvedValue({ error: null });
  });

  it("suppress mode never calls Resend but still upserts wednesdayReminderSentAt", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");

    const result = await sendReminder({
      leagueId: LEAGUE_ID,
      reminderType: "wednesday",
      preloadedData: PRELOADED_DATA,
    });

    expect(mockResendSend).not.toHaveBeenCalled();
    expect(mockLeagueWeekEmailConfigUpsert).toHaveBeenCalledOnce();
    expect(mockLeagueWeekEmailConfigUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ wednesdayReminderSentAt: expect.any(Date) }),
        update: { wednesdayReminderSentAt: expect.any(Date) },
      }),
    );
    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      skipped: 1,
      suppressed: true,
      wouldSendCount: 1,
    });
    expect(result.sentAt).toBeInstanceOf(Date);
  });

  it("suppress mode with zero outstanding members skips the upsert and returns sentAt: null", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");

    const result = await sendReminder({
      leagueId: LEAGUE_ID,
      reminderType: "wednesday",
      preloadedData: { ...PRELOADED_DATA, outstandingMembers: [] },
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

    const result = await sendReminder({
      leagueId: LEAGUE_ID,
      reminderType: "wednesday",
      preloadedData: PRELOADED_DATA,
    });

    expect(mockResendSend).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      sent: 1,
      failed: 0,
      skipped: 1,
      suppressed: false,
      wouldSendCount: 0,
    });
  });

  it("production league always uses the normal Resend path regardless of suppress mode", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");

    const result = await sendReminder({
      leagueId: LEAGUE_ID,
      reminderType: "wednesday",
      preloadedData: { ...PRELOADED_DATA, isTestLeague: false },
    });

    expect(mockResendSend).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      sent: 1,
      failed: 0,
      suppressed: false,
      wouldSendCount: 0,
    });
  });
});
