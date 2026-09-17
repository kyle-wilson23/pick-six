import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLeagueFindUnique = vi.fn();
const mockMembershipFindMany = vi.fn();
const mockResendSend = vi.fn();
const mockGetTestLeagueEmailMode = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    league: {
      findUnique: (...args: unknown[]) => mockLeagueFindUnique(...args),
    },
    leagueMembership: {
      findMany: (...args: unknown[]) => mockMembershipFindMany(...args),
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

const mockSendWithRetry = vi.fn((fn: () => Promise<unknown>) => fn());

vi.mock("@/lib/email/send-with-retry", () => ({
  sendWithRetry: (fn: () => Promise<unknown>) => mockSendWithRetry(fn),
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
import { AdminNoteNoRecipientsError } from "./admin-note";
import { LeagueNotFoundError } from "./get-tuesday-digest-data";
import { sendAdminNote } from "./send-admin-note";

const LEAGUE_ID = "league-test";
const NOTE = "Thursday deadline still stands.";

const LEAGUE = {
  id: LEAGUE_ID,
  name: "Rehearsal League",
  isTestLeague: true,
};

function memberships(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `mem-${i + 1}`,
    user: {
      id: `user-${i + 1}`,
      email: `member${i + 1}@example.com`,
      name: `Member ${i + 1}`,
    },
  }));
}

function sendArgs(
  overrides: Partial<Parameters<typeof sendAdminNote>[0]> = {},
): Parameters<typeof sendAdminNote>[0] {
  return {
    leagueId: LEAGUE_ID,
    note: NOTE,
    actorUserId: "admin-user",
    recipientMembershipIds: ["mem-1", "mem-2"],
    ...overrides,
  };
}

describe("sendAdminNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendWithRetry.mockImplementation((fn: () => Promise<unknown>) => fn());
    mockLeagueFindUnique.mockResolvedValue(LEAGUE);
    mockMembershipFindMany.mockResolvedValue(memberships(2));
    mockResendSend.mockResolvedValue({ error: null });
    mockGetTestLeagueEmailMode.mockReturnValue("send");
  });

  it("throws when the league is missing", async () => {
    mockLeagueFindUnique.mockResolvedValue(null);
    await expect(sendAdminNote(sendArgs())).rejects.toBeInstanceOf(LeagueNotFoundError);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("suppress mode never calls Resend", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");

    const result = await sendAdminNote(sendArgs());

    expect(mockResendSend).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      suppressed: true,
      wouldSendCount: 2,
      failures: [],
    });
    expect(result.sentAt).toBeInstanceOf(Date);
  });

  it("sends to each member with a unique per-send idempotency key", async () => {
    const result = await sendAdminNote(sendArgs());

    expect(mockResendSend).toHaveBeenCalledTimes(2);
    const keys = mockResendSend.mock.calls.map(
      (call) => (call[1] as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys[0]).toMatch(/^admin-note:league-test:[0-9a-f-]+:mem-1$/);
    expect(keys[1]).toMatch(/^admin-note:league-test:[0-9a-f-]+:mem-2$/);
    expect(keys[0]?.split(":")[2]).toBe(keys[1]?.split(":")[2]);
    expect(result).toMatchObject({
      sent: 2,
      failed: 0,
      suppressed: false,
      wouldSendCount: 0,
      failures: [],
    });
    expect(result.sentAt).toBeInstanceOf(Date);

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_note_complete",
        level: "info",
        message: "admin note sent",
        context: expect.objectContaining({ sent: 2, failed: 0 }),
      }),
    );

    const payload = mockResendSend.mock.calls[0]?.[0] as {
      subject: string;
      to: string[];
    };
    expect(payload.subject).toBe("[TEST][Rehearsal League] A note from your commissioner");
    expect(payload.to).toEqual(["member1@example.com"]);
  });

  it("logs warn when some members fail", async () => {
    mockResendSend.mockImplementation(async (payload: { to: string[] }) => {
      if (payload.to[0] === "member2@example.com") {
        throw new Error("bounce");
      }
      return { error: null };
    });

    const result = await sendAdminNote(sendArgs());

    expect(result).toMatchObject({ sent: 1, failed: 1, suppressed: false });
    expect(result.failures).toEqual([
      {
        membershipId: "mem-2",
        email: "member2@example.com",
        displayName: "Member 2",
        reason: "provider_error",
        error: "bounce",
      },
    ]);
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "member_send_failed",
        code: "EMAIL_SEND_FAILED",
        context: expect.objectContaining({
          membershipId: "mem-2",
          email: "member2@example.com",
          reason: "provider_error",
          error: "bounce",
        }),
      }),
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_note_complete",
        level: "warn",
        message: "admin note partially sent",
        context: expect.objectContaining({ sent: 1, failed: 1 }),
      }),
    );
  });

  it("records Resend plain-object errors as readable failure details", async () => {
    mockResendSend.mockResolvedValueOnce({
      error: { name: "validation_error", statusCode: 422, message: "Invalid `to` field" },
    });
    mockMembershipFindMany.mockResolvedValue(memberships(1));

    const result = await sendAdminNote(sendArgs());

    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(result.failures).toEqual([
      expect.objectContaining({
        membershipId: "mem-1",
        email: "member1@example.com",
        reason: "provider_error",
        error: "validation_error: 422: Invalid `to` field",
      }),
    ]);
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "member_send_failed",
        context: expect.objectContaining({
          error: "validation_error: 422: Invalid `to` field",
        }),
      }),
    );
  });

  it("throws when no requested members remain after filtering", async () => {
    mockMembershipFindMany.mockResolvedValue([]);
    await expect(sendAdminNote(sendArgs())).rejects.toBeInstanceOf(AdminNoteNoRecipientsError);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("sends only the requested eligible subset", async () => {
    mockMembershipFindMany.mockResolvedValue(memberships(5));
    const result = await sendAdminNote(
      sendArgs({ recipientMembershipIds: ["mem-2", "mem-4"] }),
    );

    expect(mockResendSend).toHaveBeenCalledTimes(2);
    expect(mockResendSend.mock.calls.map((call) => (call[0] as { to: string[] }).to[0])).toEqual([
      "member2@example.com",
      "member4@example.com",
    ]);
    expect(result).toMatchObject({ sent: 2, failed: 0, suppressed: false });
  });

  it("drops unknown ids and still sends the remainder", async () => {
    const result = await sendAdminNote(
      sendArgs({ recipientMembershipIds: ["mem-1", "foreign"] }),
    );

    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect((mockResendSend.mock.calls[0]?.[0] as { to: string[] }).to).toEqual([
      "member1@example.com",
    ]);
    expect(result.sent).toBe(1);
  });

  it("never emails the acting admin even if their membership id is requested", async () => {
    const result = await sendAdminNote(
      sendArgs({
        actorUserId: "user-1",
        recipientMembershipIds: ["mem-1", "mem-2"],
      }),
    );

    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect((mockResendSend.mock.calls[0]?.[0] as { to: string[] }).to).toEqual([
      "member2@example.com",
    ]);
    expect(result.sent).toBe(1);
  });

  it("throws when the remainder is empty after unknown ids", async () => {
    await expect(
      sendAdminNote(sendArgs({ recipientMembershipIds: ["foreign"] })),
    ).rejects.toBeInstanceOf(AdminNoteNoRecipientsError);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("uses the filtered set for suppress wouldSendCount", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");
    mockMembershipFindMany.mockResolvedValue(memberships(5));

    const result = await sendAdminNote(
      sendArgs({ recipientMembershipIds: ["mem-1", "mem-3"] }),
    );

    expect(mockResendSend).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      suppressed: true,
      wouldSendCount: 2,
      sent: 0,
      failed: 0,
    });
  });

  it("production league always uses Resend regardless of suppress mode", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");
    mockLeagueFindUnique.mockResolvedValue({ ...LEAGUE, isTestLeague: false, name: "Prod" });

    const result = await sendAdminNote(sendArgs());

    expect(mockResendSend).toHaveBeenCalledTimes(2);
    expect(result.suppressed).toBe(false);
    expect(result.sent).toBe(2);
  });

  it("counts a rate-limit 429 that succeeds on retry as sent without tripping the breaker", async () => {
    const { sendWithRetry } = await vi.importActual<typeof import("./send-with-retry")>(
      "./send-with-retry",
    );
    mockSendWithRetry.mockImplementation((fn) =>
      sendWithRetry(fn, { maxRetries: 1, baseDelayMs: 1 }),
    );
    mockMembershipFindMany.mockResolvedValue(memberships(1));
    mockResendSend
      .mockRejectedValueOnce({ statusCode: 429, name: "rate_limit_exceeded" })
      .mockResolvedValueOnce({ error: null });
    const breaker = createEmailCircuitBreaker();

    const result = await sendAdminNote(
      sendArgs({ recipientMembershipIds: ["mem-1"], breaker }),
    );

    expect(mockResendSend).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ sent: 1, failed: 0, failures: [] });
    expect(breaker.consecutiveFailures).toBe(0);
    expect(breaker.open).toBe(false);
    expect(logEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "member_send_failed" }),
    );
  });

  describe("circuit breaker", () => {
    it("opens after 3 consecutive failures and counts remaining as failed", async () => {
      mockLeagueFindUnique.mockResolvedValue({ ...LEAGUE, isTestLeague: false });
      mockResendSend.mockRejectedValue(new Error("Resend unavailable"));

      const maxClaimsBeforeAbort =
        EMAIL_SEND_CONCURRENCY + (EMAIL_CIRCUIT_FAILURE_THRESHOLD - 1);
      const memberCount = maxClaimsBeforeAbort + 2;
      mockMembershipFindMany.mockResolvedValue(memberships(memberCount));
      const breaker = createEmailCircuitBreaker();

      const ids = memberships(memberCount).map((m) => m.id);
      const result = await sendAdminNote(
        sendArgs({ recipientMembershipIds: ids, breaker }),
      );

      expect(breaker.open).toBe(true);
      expect(mockResendSend.mock.calls.length).toBeLessThan(memberCount);
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          code: EMAIL_CIRCUIT_OPEN_CODE,
          action: "circuit_open",
        }),
      );
      expect(result).toMatchObject({
        sent: 0,
        failed: memberCount,
        suppressed: false,
        sentAt: null,
      });
      expect(result.failures).toHaveLength(memberCount);
      expect(result.failures.some((f) => f.reason === "provider_error")).toBe(true);
      expect(result.failures.some((f) => f.reason === "circuit_aborted")).toBe(true);
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "member_send_failed",
          code: EMAIL_CIRCUIT_OPEN_CODE,
          message: "admin note member send aborted — circuit open",
        }),
      );
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "admin_note_complete",
          level: "error",
          message: "admin note failed",
          context: expect.objectContaining({
            sent: 0,
            failed: memberCount,
            circuitOpen: true,
          }),
        }),
      );
    });
  });
});
