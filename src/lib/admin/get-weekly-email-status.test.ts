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

import { computePickDeadlineUtc } from "@/lib/domain/pick-deadline";
import { NoActiveWeekError } from "@/lib/email/get-tuesday-digest-data";
import { easternLocal } from "@/test/season-2026-openers";

import { getWeeklyEmailStatus } from "./get-weekly-email-status";

const LEAGUE_ID = "league-1";

/** Week 1 2026 lock: Wed Sep 9 20:10 ET. Slot 1 tick Tue 07:00 ET; slot 2 tick Wed 16:00 ET. */
const WEEK_1_DEADLINE = easternLocal(2026, 8, 9, 20, 10);

/** Week 18 2026 lock: Sun Jan 10 2027 12:55 ET. Slot 1 tick Fri 15:00 ET; slot 2 tick Sun 06:00 ET. */
const WEEK_18_DEADLINE = computePickDeadlineUtc(easternLocal(2027, 0, 10, 13, 0));

const EMPTY_CONFIG = {
  sentAt: null,
  wednesdayReminderSentAt: null,
  thursdayReminderSentAt: null,
};

function digest(overrides: Record<string, unknown> = {}) {
  return {
    nflSeasonYear: 2026,
    weekNumber: 1,
    hasConcludedFirstCompetitionWeek: true,
    isPreviewWeek: false,
    pickDeadlineUtc: WEEK_1_DEADLINE,
    ...overrides,
  };
}

describe("getWeeklyEmailStatus", () => {
  beforeEach(() => {
    mockGetTuesdayDigestData.mockReset();
    mockFindUnique.mockReset();
  });

  it("returns sent when Tuesday digest sentAt is set", async () => {
    const sentAt = new Date("2026-07-08T22:04:00.000Z");
    mockGetTuesdayDigestData.mockResolvedValue(digest({ weekNumber: 7 }));
    mockFindUnique.mockResolvedValue({
      ...EMPTY_CONFIG,
      sentAt,
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
    mockGetTuesdayDigestData.mockResolvedValue(digest({ weekNumber: 7 }));
    mockFindUnique.mockResolvedValue(EMPTY_CONFIG);

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 2,
      now: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(status.tuesdayDigest).toEqual({ state: "not_sent" });
  });

  it("returns not_sent for Tuesday when sentAt is null after Tue 9 PM ET window", async () => {
    mockGetTuesdayDigestData.mockResolvedValue(digest({ weekNumber: 7 }));
    mockFindUnique.mockResolvedValue(EMPTY_CONFIG);

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 2,
      // Tue Jul 7 2026 10 PM EDT = Wed 02:00 UTC
      now: new Date("2026-07-08T02:00:00.000Z"),
    });

    expect(status.tuesdayDigest).toEqual({ state: "not_sent" });
  });

  it("returns skipped for First pick reminder when outstandingCount is zero", async () => {
    mockGetTuesdayDigestData.mockResolvedValue(digest());
    mockFindUnique.mockResolvedValue({
      ...EMPTY_CONFIG,
      sentAt: new Date("2026-09-08T22:00:00.000Z"),
    });

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 0,
      now: easternLocal(2026, 8, 10, 5, 0),
    });

    expect(status.wednesdayReminder).toEqual({ state: "skipped", reason: "no_outstanding" });
  });

  it("returns pending for both reminders before the first eligible tick", async () => {
    mockGetTuesdayDigestData.mockResolvedValue(digest());
    mockFindUnique.mockResolvedValue(EMPTY_CONFIG);

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 3,
      now: easternLocal(2026, 8, 7, 16, 0),
    });

    expect(status.wednesdayReminder).toEqual({ state: "pending" });
    expect(status.thursdayReminder).toEqual({ state: "pending" });
  });

  it("returns not_sent for First pick reminder after its tick while Final stays pending", async () => {
    mockGetTuesdayDigestData.mockResolvedValue(digest());
    mockFindUnique.mockResolvedValue(EMPTY_CONFIG);

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 3,
      now: easternLocal(2026, 8, 8, 10, 0),
    });

    expect(status.wednesdayReminder).toEqual({ state: "not_sent" });
    expect(status.thursdayReminder).toEqual({ state: "pending" });
  });

  it("returns not_sent for both reminders after the final tick when stamps are missing", async () => {
    mockGetTuesdayDigestData.mockResolvedValue(digest());
    mockFindUnique.mockResolvedValue(EMPTY_CONFIG);

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 3,
      now: easternLocal(2026, 8, 9, 17, 0),
    });

    expect(status.wednesdayReminder).toEqual({ state: "not_sent" });
    expect(status.thursdayReminder).toEqual({ state: "not_sent" });
  });

  it("keeps a Sunday-opener Final reminder pending on Friday after the First tick", async () => {
    mockGetTuesdayDigestData.mockResolvedValue(
      digest({
        nflSeasonYear: 2026,
        weekNumber: 18,
        pickDeadlineUtc: WEEK_18_DEADLINE,
      }),
    );
    mockFindUnique.mockResolvedValue(EMPTY_CONFIG);

    const fridayAfterSlot1 = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 3,
      now: easternLocal(2027, 0, 8, 16, 0),
    });
    expect(fridayAfterSlot1.wednesdayReminder).toEqual({ state: "not_sent" });
    expect(fridayAfterSlot1.thursdayReminder).toEqual({ state: "pending" });

    const fridayBeforeSlot1 = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 3,
      now: easternLocal(2027, 0, 8, 10, 0),
    });
    expect(fridayBeforeSlot1.wednesdayReminder).toEqual({ state: "pending" });
    expect(fridayBeforeSlot1.thursdayReminder).toEqual({ state: "pending" });
  });

  it("returns not_sent for reminders after the pick deadline", async () => {
    mockGetTuesdayDigestData.mockResolvedValue(digest());
    mockFindUnique.mockResolvedValue(EMPTY_CONFIG);

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 3,
      now: easternLocal(2026, 8, 9, 20, 11),
    });

    expect(status.wednesdayReminder).toEqual({ state: "not_sent" });
    expect(status.thursdayReminder).toEqual({ state: "not_sent" });
  });

  it("returns not_sent for reminders when the week has no deadline", async () => {
    mockGetTuesdayDigestData.mockResolvedValue(digest({ pickDeadlineUtc: null }));
    mockFindUnique.mockResolvedValue(EMPTY_CONFIG);

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 3,
      now: easternLocal(2026, 8, 8, 10, 0),
    });

    expect(status.wednesdayReminder).toEqual({ state: "not_sent" });
    expect(status.thursdayReminder).toEqual({ state: "not_sent" });
  });

  it("returns pending for reminders during a preview week before the deadline", async () => {
    mockGetTuesdayDigestData.mockResolvedValue(digest({ isPreviewWeek: true }));
    mockFindUnique.mockResolvedValue(EMPTY_CONFIG);

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 3,
      now: easternLocal(2026, 8, 8, 10, 0),
    });

    expect(status.wednesdayReminder).toEqual({ state: "pending" });
    expect(status.thursdayReminder).toEqual({ state: "pending" });
  });

  it("returns skipped for Tuesday when the first competition week has not concluded", async () => {
    mockGetTuesdayDigestData.mockResolvedValue(
      digest({ hasConcludedFirstCompetitionWeek: false }),
    );
    mockFindUnique.mockResolvedValue(EMPTY_CONFIG);

    const status = await getWeeklyEmailStatus({
      leagueId: LEAGUE_ID,
      outstandingCount: 2,
      now: new Date("2026-09-08T23:00:00.000Z"),
    });

    expect(status.tuesdayDigest).toEqual({ state: "skipped", reason: "no_completed_week" });
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
