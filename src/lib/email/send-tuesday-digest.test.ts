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

import { logEvent } from "@/lib/logging/log-event";
import { EMAIL_SEND_CONCURRENCY } from "./map-with-concurrency";
import {
  EMAIL_CIRCUIT_FAILURE_THRESHOLD,
  EMAIL_CIRCUIT_OPEN_CODE,
  createEmailCircuitBreaker,
} from "./circuit-breaker";
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

/** ≥4 members so abort-remaining is observable after threshold opens (Story 9.4 AC3). */
function members(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    membershipId: `mem-${i + 1}`,
    email: `member${i + 1}@example.com`,
    displayName: `Member ${i + 1}`,
  }));
}

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

  describe("circuit-breaker outage drill (Story 9.4 AC3)", () => {
    it("opens after 3 consecutive Resend failures, logs EMAIL_CIRCUIT_OPEN, aborts remaining members", async () => {
      // Production-like path — never suppress (suppress bypasses Resend + breaker).
      mockGetTestLeagueEmailMode.mockReturnValue("send");
      mockResendSend.mockRejectedValue(new Error("Resend unavailable"));

      // Worst-case Resend claims before abort: concurrency + (threshold - 1).
      // memberCount must exceed that so lessThan(memberCount) cannot flake.
      const maxClaimsBeforeAbort =
        EMAIL_SEND_CONCURRENCY + (EMAIL_CIRCUIT_FAILURE_THRESHOLD - 1);
      const memberCount = maxClaimsBeforeAbort + 2;
      const breaker = createEmailCircuitBreaker();

      const result = await sendTuesdayDigest({
        leagueId: LEAGUE_ID,
        preloadedData: {
          ...PRELOADED_DATA,
          isTestLeague: false,
          members: members(memberCount),
        },
        breaker,
      });

      expect(breaker.open).toBe(true);
      expect(breaker.consecutiveFailures).toBe(EMAIL_CIRCUIT_FAILURE_THRESHOLD);
      expect(mockResendSend.mock.calls.length).toBeGreaterThanOrEqual(
        EMAIL_CIRCUIT_FAILURE_THRESHOLD,
      );
      expect(mockResendSend.mock.calls.length).toBeLessThanOrEqual(
        maxClaimsBeforeAbort,
      );
      expect(mockResendSend.mock.calls.length).toBeLessThan(memberCount);

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          code: EMAIL_CIRCUIT_OPEN_CODE,
          action: "circuit_open",
          leagueId: LEAGUE_ID,
          context: expect.objectContaining({
            consecutiveFailures: EMAIL_CIRCUIT_FAILURE_THRESHOLD,
            remainingAborted: true,
          }),
        }),
      );

      expect(result).toMatchObject({
        sent: 0,
        failed: memberCount,
        suppressed: false,
        sentAt: null,
      });
    });

    it("shared breaker aborts a second league without further Resend calls", async () => {
      mockGetTestLeagueEmailMode.mockReturnValue("send");
      mockResendSend.mockRejectedValue(new Error("Resend unavailable"));

      const breaker = createEmailCircuitBreaker();
      const leagueA = {
        ...PRELOADED_DATA,
        isTestLeague: false,
        members: members(4),
      };
      const leagueBId = "league-b";
      const leagueB = {
        ...PRELOADED_DATA,
        leagueId: leagueBId,
        isTestLeague: false,
        members: members(3),
      };

      const first = await sendTuesdayDigest({
        leagueId: LEAGUE_ID,
        preloadedData: leagueA,
        breaker,
      });
      expect(breaker.open).toBe(true);
      expect(first.failed).toBe(4);

      const resendAfterFirst = mockResendSend.mock.calls.length;

      const second = await sendTuesdayDigest({
        leagueId: leagueBId,
        preloadedData: leagueB,
        breaker,
      });

      expect(mockResendSend.mock.calls.length).toBe(resendAfterFirst);
      expect(second).toMatchObject({
        sent: 0,
        failed: 3,
        suppressed: false,
        sentAt: null,
      });
    });
  });
});
