import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLeagueWeekEmailConfigFindUnique = vi.fn();
const mockLeagueWeekEmailConfigUpsert = vi.fn();
const mockResendSend = vi.fn();
const mockGetTestLeagueEmailMode = vi.fn();
const mockRunCommentary = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueWeekEmailConfig: {
      findUnique: (...args: unknown[]) => mockLeagueWeekEmailConfigFindUnique(...args),
      upsert: (...args: unknown[]) => mockLeagueWeekEmailConfigUpsert(...args),
    },
  },
}));

vi.mock("@/lib/commentary/run-commentary", () => ({
  runCommentary: (...args: unknown[]) => mockRunCommentary(...args),
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
  isPreviewWeek: false,
  hasConcludedFirstCompetitionWeek: true,
  pickDeadlineUtc: new Date("2026-09-10T00:10:00.000Z"),
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
    mockRunCommentary.mockResolvedValue({ sentences: [] });
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

  it.each([false, undefined])(
    "send with commentaryEnabled %s creates no run and adds no note",
    async (commentaryEnabled) => {
      mockGetTestLeagueEmailMode.mockReturnValue("send");

      const result = await sendTuesdayDigest({
        leagueId: LEAGUE_ID,
        preloadedData: { ...PRELOADED_DATA, isTestLeague: false, commentaryEnabled },
      });

      expect(result).toMatchObject({
        sent: 2,
        failed: 0,
        suppressed: false,
        wouldSendCount: 0,
      });
      expect(mockRunCommentary).not.toHaveBeenCalled();
      expect(mockLeagueWeekEmailConfigUpsert).toHaveBeenCalledOnce();

      const payloads = mockResendSend.mock.calls.map((call) => call[0] as { react?: ReactElement });
      expect(payloads).toHaveLength(PRELOADED_DATA.members.length);
      for (const payload of payloads) {
        if (!payload.react) {
          throw new Error("expected Tuesday digest email element");
        }
        expect(payload.react.props).not.toHaveProperty("commentary");
        expect(payload.react.props).not.toHaveProperty("commentaryEnabled");
        const html = await render(payload.react);
        expect(html).toContain("Standings");
        expect(html).toContain("Jailed team");
        expect(html).not.toContain("This week");
        expect(html).not.toContain("Quiet week. Nothing new for the record book.");
      }
    },
  );

  it("suppress mode with commentary on creates no run", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");

    await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: { ...PRELOADED_DATA, commentaryEnabled: true },
    });

    expect(mockRunCommentary).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("an already-open breaker with commentary on creates no run", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("send");
    const breaker = createEmailCircuitBreaker();
    breaker.open = true;

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: { ...PRELOADED_DATA, isTestLeague: false, commentaryEnabled: true },
      breaker,
    });

    expect(mockRunCommentary).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, failed: 2, suppressed: false, sentAt: null });
  });

  it("a delivering send with no recipients creates no run", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("send");

    await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: {
        ...PRELOADED_DATA,
        isTestLeague: false,
        commentaryEnabled: true,
        members: [],
      },
    });

    expect(mockRunCommentary).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("a delivering on-send shows proved lines once, and standings and jailed text remain", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("send");
    mockLeagueWeekEmailConfigFindUnique.mockResolvedValue({ bodyText: "Bring snacks" });
    const sentences = ["Alice took Buffalo for two.", "Bob lost with the Jets."];
    mockRunCommentary.mockResolvedValue({ sentences });

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: {
        ...PRELOADED_DATA,
        isTestLeague: false,
        commentaryEnabled: true,
        standings: [
          {
            membershipId: "mem-1",
            rank: 1,
            displayName: "Alice",
            imageUrl: null,
            totalPoints: 4,
            wins: 2,
            losses: 0,
            ties: 0,
            missedWeeks: 0,
          },
        ],
        jailedTeamName: "Buffalo Bills",
        jailedTeamAbbreviation: "BUF",
      },
    });

    expect(result.sent).toBe(2);
    expect(mockRunCommentary).toHaveBeenCalledOnce();
    expect(mockRunCommentary).toHaveBeenCalledWith({
      leagueId: LEAGUE_ID,
      nflSeasonYear: 2026,
      weekNumber: 1,
    });
    const payloads = mockResendSend.mock.calls.map((call) => call[0] as { react?: ReactElement });
    expect(payloads).toHaveLength(2);
    for (const payload of payloads) {
      if (!payload.react) throw new Error("expected Tuesday digest email element");
      const html = await render(payload.react);
      expect(html).toContain("Standings");
      expect(html).toContain("Alice");
      expect(html).toContain("Jailed team");
      expect(html).toContain("Buffalo Bills (BUF)");
      for (const sentence of sentences) {
        expect(html).toContain(sentence);
      }
      expect(html.indexOf("Jailed team")).toBeLessThan(html.indexOf("This week"));
      expect(html.indexOf("This week")).toBeLessThan(html.indexOf("Make your picks"));
      expect(html.indexOf("Make your picks")).toBeLessThan(
        html.indexOf("Note from your commissioner"),
      );
    }
  });

  it("a delivering on-send shows the quiet sentence", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("send");
    mockRunCommentary.mockResolvedValue({
      sentences: ["Quiet week. Nothing new for the record book."],
    });

    await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: { ...PRELOADED_DATA, isTestLeague: false, commentaryEnabled: true },
    });

    const payload = mockResendSend.mock.calls[0][0] as { react?: ReactElement };
    const html = await render(payload.react!);
    expect(html).toContain("Quiet week. Nothing new for the record book.");
    expect(html).toContain("Standings");
    expect(html).toContain("Jailed team");
  });

  it("hides the section on a stop and still sends scores", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("send");
    mockRunCommentary.mockResolvedValue({ sentences: [] });

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: { ...PRELOADED_DATA, isTestLeague: false, commentaryEnabled: true },
    });

    expect(result).toMatchObject({ sent: 2, failed: 0 });
    const html = await render(
      (mockResendSend.mock.calls[0][0] as { react: ReactElement }).react,
    );
    expect(html).not.toContain("This week");
    expect(html).not.toContain("Quiet week. Nothing new for the record book.");
    expect(html).toContain("Standings");
    expect(html).toContain("Jailed team");
  });

  it("still sends scores when the runner throws", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("send");
    mockRunCommentary.mockRejectedValue(new Error("database down"));

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: { ...PRELOADED_DATA, isTestLeague: false, commentaryEnabled: true },
    });

    expect(result).toMatchObject({ sent: 2, failed: 0, suppressed: false });
    expect(mockResendSend).toHaveBeenCalledTimes(2);
    const html = await render(
      (mockResendSend.mock.calls[0][0] as { react: ReactElement }).react,
    );
    expect(html).not.toContain("This week");
    expect(html).toContain("Standings");
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
