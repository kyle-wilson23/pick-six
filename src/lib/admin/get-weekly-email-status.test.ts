import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetTuesdayDigestData = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/email/get-tuesday-digest-data", () => ({
  getTuesdayDigestData: (...args: unknown[]) => mockGetTuesdayDigestData(...args),
  NoActiveWeekError: class NoActiveWeekError extends Error {
    constructor() {
      super("No active week for Tuesday digest");
      this.name = "NoActiveWeekError";
    }
  },
  LeagueNotFoundError: class LeagueNotFoundError extends Error {
    constructor(leagueId: string) {
      super(`League not found: ${leagueId}`);
      this.name = "LeagueNotFoundError";
    }
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueWeekEmailConfig: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { NoActiveWeekError } from "@/lib/email/get-tuesday-digest-data";
import { getWeeklyEmailStatus } from "./get-weekly-email-status";

const LEAGUE_ID = "league-1";

describe("getWeeklyEmailStatus", () => {
  beforeEach(() => {
    mockGetTuesdayDigestData.mockReset();
    mockFindUnique.mockReset();
  });

  it("returns sent when Tuesday digest sentAt is set", async () => {
    const sentAt = new Date("2026-07-08T22:04:00.000Z");
    mockGetTuesdayDigestData.mockResolvedValue({
      nflSeasonYear: 2026,
      weekNumber: 7,
    });
    mockFindUnique.mockResolvedValue({
      sentAt,
      wednesdayReminderSentAt: null,
      thursdayReminderSentAt: null,
    });

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 2,
      now: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(status.weekNumber).toBe(7);
    expect(status.tuesdayDigest).toEqual({ state: "sent", sentAtIso: sentAt.toISOString() });
  });

  it("returns not_sent for Tuesday when sentAt is null on Wednesday morning ET", async () => {
    mockGetTuesdayDigestData.mockResolvedValue({
      nflSeasonYear: 2026,
      weekNumber: 7,
    });
    mockFindUnique.mockResolvedValue({
      sentAt: null,
      wednesdayReminderSentAt: null,
      thursdayReminderSentAt: null,
    });

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 2,
      now: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(status.tuesdayDigest).toEqual({ state: "not_sent" });
  });

  it("returns not_sent for Tuesday when sentAt is null after Tue 9 PM ET window", async () => {
    mockGetTuesdayDigestData.mockResolvedValue({
      nflSeasonYear: 2026,
      weekNumber: 7,
    });
    mockFindUnique.mockResolvedValue({
      sentAt: null,
      wednesdayReminderSentAt: null,
      thursdayReminderSentAt: null,
    });

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 2,
      // Tue Jul 7 2026 10 PM EDT = Wed 02:00 UTC
      now: new Date("2026-07-08T02:00:00.000Z"),
    });

    expect(status.tuesdayDigest).toEqual({ state: "not_sent" });
  });

  it("returns skipped for Wednesday reminder when outstandingCount is zero", async () => {
    mockGetTuesdayDigestData.mockResolvedValue({
      nflSeasonYear: 2026,
      weekNumber: 7,
    });
    mockFindUnique.mockResolvedValue({
      sentAt: new Date("2026-07-08T22:00:00.000Z"),
      wednesdayReminderSentAt: null,
      thursdayReminderSentAt: null,
    });

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 0,
      now: new Date("2026-07-10T05:00:00.000Z"),
    });

    expect(status.wednesdayReminder).toEqual({ state: "skipped", reason: "no_outstanding" });
  });

  it("returns not_sent for Wednesday reminder when outstanding > 0 and past window", async () => {
    mockGetTuesdayDigestData.mockResolvedValue({
      nflSeasonYear: 2026,
      weekNumber: 7,
    });
    mockFindUnique.mockResolvedValue({
      sentAt: new Date("2026-07-08T22:00:00.000Z"),
      wednesdayReminderSentAt: null,
      thursdayReminderSentAt: null,
    });

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 3,
      now: new Date("2026-07-10T05:00:00.000Z"),
    });

    expect(status.wednesdayReminder).toEqual({ state: "not_sent" });
  });

  it("returns weekNumber null when there is no active week", async () => {
    mockGetTuesdayDigestData.mockRejectedValue(new NoActiveWeekError());

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 0,
      now: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(status.weekNumber).toBeNull();
    expect(status.tuesdayDigest).toEqual({ state: "pending" });
    expect(status.wednesdayReminder).toEqual({ state: "pending" });
    expect(status.thursdayReminder).toEqual({ state: "pending" });
  });
});
