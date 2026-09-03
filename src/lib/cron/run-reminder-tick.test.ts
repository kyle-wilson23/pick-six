import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetActiveLeagueIds = vi.fn();
const mockGetReminderData = vi.fn();
const mockSendReminder = vi.fn();
const mockFindUnique = vi.fn();
const mockLogEvent = vi.fn();

vi.mock("@/lib/cron/get-active-league-ids", () => ({
  getActiveLeagueIds: (...args: unknown[]) => mockGetActiveLeagueIds(...args),
}));

vi.mock("@/lib/email/get-reminder-data", () => ({
  LeagueNotFoundError: class LeagueNotFoundError extends Error {
    constructor(leagueId: string) {
      super(`League not found: ${leagueId}`);
      this.name = "LeagueNotFoundError";
    }
  },
  NoActiveWeekError: class NoActiveWeekError extends Error {
    constructor() {
      super("No active week");
      this.name = "NoActiveWeekError";
    }
  },
  getReminderData: (...args: unknown[]) => mockGetReminderData(...args),
}));

vi.mock("@/lib/email/send-reminder", () => ({
  sendReminder: (...args: unknown[]) => mockSendReminder(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueWeekEmailConfig: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/logging/log-event", () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

import { EMAIL_CIRCUIT_OPEN_CODE, recordEmailSendFailure } from "@/lib/email/circuit-breaker";
import { NoActiveWeekError } from "@/lib/email/get-reminder-data";
import { easternLocal } from "@/test/season-2026-openers";

import { runReminderTick } from "./run-reminder-tick";

const LEAGUE_A = "league-a";
const LEAGUE_B = "league-b";
const WEEK_1_DEADLINE = easternLocal(2026, 8, 9, 20, 10);
const SLOT_1_TICK = easternLocal(2026, 8, 8, 7, 0);
const SLOT_2_TICK = easternLocal(2026, 8, 9, 16, 0);

function reminderData(overrides: Record<string, unknown> = {}) {
  return {
    leagueName: "Test League",
    leagueId: LEAGUE_A,
    isTestLeague: false,
    nflSeasonYear: 2026,
    weekNumber: 1,
    isPreviewWeek: false,
    pickDeadlineUtc: WEEK_1_DEADLINE,
    jailedTeamName: null,
    jailedTeamAbbreviation: null,
    picksUrl: "http://localhost:3000/leagues/league-a/picks",
    outstandingMembers: [{ membershipId: "mem-1", email: "a@example.com", displayName: "A" }],
    submittedCount: 0,
    ...overrides,
  };
}

function sendOk(slot: 1 | 2) {
  return {
    sent: 1,
    failed: 0,
    skipped: 0,
    sentAt: new Date(),
    suppressed: false,
    wouldSendCount: 0,
    slot,
  };
}

describe("runReminderTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveLeagueIds.mockResolvedValue([LEAGUE_A]);
    mockFindUnique.mockResolvedValue(null);
    mockSendReminder.mockResolvedValue(sendOk(1));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends slot 1 on the first eligible tick and does not also send slot 2", async () => {
    mockGetReminderData.mockResolvedValue(reminderData());

    const body = await runReminderTick({
      route: "/api/cron/reminder-tick-am",
      now: SLOT_1_TICK,
    });

    expect(mockSendReminder).toHaveBeenCalledOnce();
    expect(mockSendReminder).toHaveBeenCalledWith(
      expect.objectContaining({ leagueId: LEAGUE_A, slot: 1 }),
    );
    expect(body).toMatchObject({ processed: 1, sent: 1, failed: 0, skippedNotDue: 0 });
  });

  it("sends slot 2 when slot 1 is already stamped and slot 2 is due", async () => {
    mockGetReminderData.mockResolvedValue(reminderData());
    mockFindUnique.mockResolvedValue({
      wednesdayReminderSentAt: SLOT_1_TICK,
      thursdayReminderSentAt: null,
    });
    mockSendReminder.mockResolvedValue(sendOk(2));

    const body = await runReminderTick({
      route: "/api/cron/reminder-tick-pm",
      now: SLOT_2_TICK,
    });

    expect(mockSendReminder).toHaveBeenCalledOnce();
    expect(mockSendReminder).toHaveBeenCalledWith(
      expect.objectContaining({ leagueId: LEAGUE_A, slot: 2 }),
    );
    expect(body.sent).toBe(1);
  });

  it("late deploy: at a slot-2 tick with neither stamp, sends only slot 1", async () => {
    mockGetReminderData.mockResolvedValue(reminderData());

    await runReminderTick({
      route: "/api/cron/reminder-tick-pm",
      now: SLOT_2_TICK,
    });

    expect(mockSendReminder).toHaveBeenCalledOnce();
    expect(mockSendReminder).toHaveBeenCalledWith(
      expect.objectContaining({ slot: 1 }),
    );
  });

  it("falls through to slot 2 when slot 1 is due but nobody is outstanding", async () => {
    mockGetReminderData.mockResolvedValue(reminderData());
    mockSendReminder
      .mockResolvedValueOnce({
        sent: 0,
        failed: 0,
        skipped: 1,
        sentAt: null,
        suppressed: false,
        wouldSendCount: 0,
      })
      .mockResolvedValueOnce(sendOk(2));

    const body = await runReminderTick({
      route: "/api/cron/reminder-tick-pm",
      now: SLOT_2_TICK,
    });

    expect(mockSendReminder).toHaveBeenCalledTimes(2);
    expect(mockSendReminder.mock.calls[0][0]).toMatchObject({ slot: 1 });
    expect(mockSendReminder.mock.calls[1][0]).toMatchObject({ slot: 2 });
    expect(body.sent).toBe(1);
  });

  it("skips preview weeks without evaluating slots", async () => {
    mockGetReminderData.mockResolvedValue(reminderData({ isPreviewWeek: true }));

    const body = await runReminderTick({
      route: "/api/cron/reminder-tick-am",
      now: SLOT_1_TICK,
    });

    expect(mockSendReminder).not.toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(body.skippedPreview).toBe(1);
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CRON_PREVIEW_WEEK" }),
    );
  });

  it("skips past the deadline without sending", async () => {
    mockGetReminderData.mockResolvedValue(reminderData());

    const body = await runReminderTick({
      route: "/api/cron/reminder-tick-am",
      now: easternLocal(2026, 8, 9, 20, 11),
    });

    expect(mockSendReminder).not.toHaveBeenCalled();
    expect(body.skippedPastDeadline).toBe(1);
  });

  it("counts leagues with no active week", async () => {
    mockGetReminderData.mockRejectedValue(new NoActiveWeekError());

    const body = await runReminderTick({
      route: "/api/cron/reminder-tick-am",
      now: SLOT_1_TICK,
    });

    expect(body.skippedNoWeek).toBe(1);
    expect(mockSendReminder).not.toHaveBeenCalled();
  });

  it("skips remaining leagues when the circuit opens", async () => {
    mockGetActiveLeagueIds.mockResolvedValue([LEAGUE_A, LEAGUE_B]);
    mockGetReminderData.mockResolvedValue(reminderData());
    mockSendReminder.mockImplementation(
      async ({ breaker }: { breaker: Parameters<typeof recordEmailSendFailure>[0] }) => {
        recordEmailSendFailure(breaker);
        recordEmailSendFailure(breaker);
        recordEmailSendFailure(breaker);
        return { sent: 0, failed: 3, skipped: 0, sentAt: null, suppressed: false, wouldSendCount: 0 };
      },
    );

    const body = await runReminderTick({
      route: "/api/cron/reminder-tick-am",
      now: SLOT_1_TICK,
    });

    expect(mockSendReminder).toHaveBeenCalledOnce();
    expect(body.failed).toBeGreaterThanOrEqual(2);
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        code: EMAIL_CIRCUIT_OPEN_CODE,
        leagueId: LEAGUE_B,
      }),
    );
  });
});
