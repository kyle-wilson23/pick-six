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
    user: { email: `member${i + 1}@example.com` },
  }));
}

describe("sendAdminNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeagueFindUnique.mockResolvedValue(LEAGUE);
    mockMembershipFindMany.mockResolvedValue(memberships(2));
    mockResendSend.mockResolvedValue({ error: null });
    mockGetTestLeagueEmailMode.mockReturnValue("send");
  });

  it("throws when the league is missing", async () => {
    mockLeagueFindUnique.mockResolvedValue(null);
    await expect(sendAdminNote({ leagueId: LEAGUE_ID, note: NOTE })).rejects.toBeInstanceOf(
      LeagueNotFoundError,
    );
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("suppress mode never calls Resend", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");

    const result = await sendAdminNote({ leagueId: LEAGUE_ID, note: NOTE });

    expect(mockResendSend).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      suppressed: true,
      wouldSendCount: 2,
    });
    expect(result.sentAt).toBeInstanceOf(Date);
  });

  it("sends to each member with a unique per-send idempotency key", async () => {
    const result = await sendAdminNote({ leagueId: LEAGUE_ID, note: NOTE });

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
    mockResendSend
      .mockResolvedValueOnce({ error: null })
      .mockRejectedValueOnce(new Error("bounce"));

    const result = await sendAdminNote({ leagueId: LEAGUE_ID, note: NOTE });

    expect(result).toMatchObject({ sent: 1, failed: 1, suppressed: false });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_note_complete",
        level: "warn",
        message: "admin note partially sent",
        context: expect.objectContaining({ sent: 1, failed: 1 }),
      }),
    );
  });

  it("returns sent 0 when there are no members", async () => {
    mockMembershipFindMany.mockResolvedValue([]);
    const result = await sendAdminNote({ leagueId: LEAGUE_ID, note: NOTE });
    expect(mockResendSend).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      sentAt: null,
      suppressed: false,
    });
  });

  it("production league always uses Resend regardless of suppress mode", async () => {
    mockGetTestLeagueEmailMode.mockReturnValue("suppress");
    mockLeagueFindUnique.mockResolvedValue({ ...LEAGUE, isTestLeague: false, name: "Prod" });

    const result = await sendAdminNote({ leagueId: LEAGUE_ID, note: NOTE });

    expect(mockResendSend).toHaveBeenCalledTimes(2);
    expect(result.suppressed).toBe(false);
    expect(result.sent).toBe(2);
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

      const result = await sendAdminNote({
        leagueId: LEAGUE_ID,
        note: NOTE,
        breaker,
      });

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
