import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLeagueWeekEmailConfigFindUnique = vi.fn();
const mockLeagueWeekEmailConfigUpsert = vi.fn();
const mockCommentaryRunCreate = vi.fn();
const mockCommentaryRunUpdate = vi.fn();
const mockCommentaryRunUpsert = vi.fn();
const mockResendSend = vi.fn();
const mockGetTestLeagueEmailMode = vi.fn();
const mockRunWeeklyCommentary = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueWeekEmailConfig: {
      findUnique: (...args: unknown[]) => mockLeagueWeekEmailConfigFindUnique(...args),
      upsert: (...args: unknown[]) => mockLeagueWeekEmailConfigUpsert(...args),
    },
    commentaryRun: {
      create: (...args: unknown[]) => mockCommentaryRunCreate(...args),
      update: (...args: unknown[]) => mockCommentaryRunUpdate(...args),
      upsert: (...args: unknown[]) => mockCommentaryRunUpsert(...args),
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

vi.mock("@/lib/commentary/runner", () => ({
  runWeeklyCommentary: (...args: unknown[]) => mockRunWeeklyCommentary(...args),
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
    mockRunWeeklyCommentary.mockResolvedValue({ outcomeText: null });
  });

  it("suppress mode never calls Resend but still upserts sentAt", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: PRELOADED_DATA,
    });

    expect(mockResendSend).not.toHaveBeenCalled();
    expect(mockRunWeeklyCommentary).not.toHaveBeenCalled();
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
    "send with commentaryEnabled %s adds no commentary section, run, or spend",
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
      expect(mockRunWeeklyCommentary).not.toHaveBeenCalled();
      expect(mockCommentaryRunCreate).not.toHaveBeenCalled();
      expect(mockCommentaryRunUpdate).not.toHaveBeenCalled();
      expect(mockCommentaryRunUpsert).not.toHaveBeenCalled();
      expect(mockLeagueWeekEmailConfigUpsert).toHaveBeenCalledOnce();

      const payloads = mockResendSend.mock.calls.map(
        (call) => call[0] as { react?: ReactElement<{ weeklyNote?: string | null }> },
      );
      expect(payloads).toHaveLength(PRELOADED_DATA.members.length);
      for (const payload of payloads) {
        if (!payload.react) {
          throw new Error("expected Tuesday digest email element");
        }
        expect(payload.react.props).not.toHaveProperty("commentary");
        expect(payload.react.props).not.toHaveProperty("commentaryEnabled");
        expect(payload.react.props.weeklyNote).toBeNull();
        const html = await render(payload.react);
        expect(html).toContain("Standings");
        expect(html).toContain("Jailed team");
        expect(html).not.toContain("Weekly note");
        expect(html).not.toContain("Quiet week");
      }
    },
  );

  it("a suppressed test league with commentary on does not run or spend", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: { ...PRELOADED_DATA, commentaryEnabled: true },
    });

    expect(mockRunWeeklyCommentary).not.toHaveBeenCalled();
    expect(mockCommentaryRunCreate).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
    expect(result).toMatchObject({ suppressed: true, sent: 0, wouldSendCount: 2 });
  });

  it("a delivering send with commentary on runs once and renders the settled note", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("send");
    mockRunWeeklyCommentary.mockResolvedValue({ outcomeText: "Alex won the week." });

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: { ...PRELOADED_DATA, isTestLeague: false, commentaryEnabled: true },
    });

    expect(result).toMatchObject({ sent: 2, failed: 0, suppressed: false });
    expect(mockRunWeeklyCommentary).toHaveBeenCalledTimes(1);
    expect(mockRunWeeklyCommentary).toHaveBeenCalledWith({
      leagueId: LEAGUE_ID,
      nflSeasonYear: PRELOADED_DATA.nflSeasonYear,
      weekNumber: PRELOADED_DATA.weekNumber,
    });

    const payloads = mockResendSend.mock.calls.map(
      (call) => call[0] as { react?: ReactElement<{ weeklyNote?: string | null }> },
    );
    for (const payload of payloads) {
      if (!payload.react) {
        throw new Error("expected Tuesday digest email element");
      }
      expect(payload.react.props.weeklyNote).toBe("Alex won the week.");
      const html = await render(payload.react);
      expect(html).toContain("Weekly note");
      expect(html).toContain("Alex won the week.");
      expect(html.indexOf("Weekly note")).toBeLessThan(html.indexOf("Make your picks"));
    }
  });

  it("an abnormal commentary run still sends scores and omits the section", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("send");
    mockRunWeeklyCommentary.mockResolvedValue({ outcomeText: null });

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: { ...PRELOADED_DATA, isTestLeague: false, commentaryEnabled: true },
    });

    expect(result).toMatchObject({ sent: 2, failed: 0, suppressed: false });
    expect(mockRunWeeklyCommentary).toHaveBeenCalledTimes(1);
    const html = await render((mockResendSend.mock.calls[0]?.[0] as { react: ReactElement }).react);
    expect(html).not.toContain("Weekly note");
    expect(html).not.toContain("Quiet week");
    expect(html).toContain("Standings");
  });

  it("a runner failure still sends the scores email without a note", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("send");
    mockRunWeeklyCommentary.mockRejectedValue(new Error("commentary down"));

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: { ...PRELOADED_DATA, isTestLeague: false, commentaryEnabled: true },
    });

    expect(result).toMatchObject({ sent: 2, failed: 0, suppressed: false });
    expect(mockResendSend).toHaveBeenCalledTimes(2);
    const html = await render((mockResendSend.mock.calls[0]?.[0] as { react: ReactElement }).react);
    expect(html).not.toContain("Weekly note");
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        action: "commentary_run_failed",
        leagueId: LEAGUE_ID,
      }),
    );
  });

  it("does not run commentary when the circuit is already open", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("send");
    const breaker = createEmailCircuitBreaker();
    breaker.open = true;

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: { ...PRELOADED_DATA, isTestLeague: false, commentaryEnabled: true },
      breaker,
    });

    expect(mockRunWeeklyCommentary).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, failed: 2, suppressed: false });
  });

  it("does not run commentary when the send has no recipients", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("send");

    const result = await sendTuesdayDigest({
      leagueId: LEAGUE_ID,
      preloadedData: {
        ...PRELOADED_DATA,
        isTestLeague: false,
        commentaryEnabled: true,
        members: [],
      },
    });

    expect(mockRunWeeklyCommentary).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, failed: 0, suppressed: false });
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
