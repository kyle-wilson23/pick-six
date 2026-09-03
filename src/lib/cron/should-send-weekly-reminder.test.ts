import { formatInTimeZone } from "date-fns-tz";
import { describe, expect, it } from "vitest";

import { computePickDeadlineUtc } from "@/lib/domain/pick-deadline";
import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";
import { SEASON_2026_OPENERS, easternLocal } from "@/test/season-2026-openers";

import {
  REMINDER_SLOT_LEAD_HOURS,
  isPastPickDeadline,
  shouldSendWeeklyReminder,
  summarizeReminderSkip,
} from "./should-send-weekly-reminder";

const TZ = LEAGUE_BUSINESS_TIMEZONE;

/** Week 1 2026 lock: Wed Sep 9 20:10 ET. */
const WEEK_1_DEADLINE = easternLocal(2026, 8, 9, 20, 10);

function easternWall(at: Date): string {
  return formatInTimeZone(at, TZ, "yyyy-MM-dd HH:mm");
}

const TICK_UTC_HOURS = [11, 20] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Every 11:00 and 20:00 UTC tick in `[from, to]` (inclusive). */
function utcTicks(from: Date, to: Date): Date[] {
  const ticks: Date[] = [];
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const startDay = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  for (let day = startDay; day <= toMs + MS_PER_DAY; day += MS_PER_DAY) {
    for (const hour of TICK_UTC_HOURS) {
      const t = day + hour * 60 * 60 * 1000;
      if (t >= fromMs && t <= toMs) {
        ticks.push(new Date(t));
      }
    }
  }
  return ticks;
}

/**
 * Replay both daily ticks against one week's deadline, stamping each slot on the first tick that
 * would send it and emitting at most one slot per tick (mirrors `runReminderTick`).
 */
function replaySlots(deadline: Date): { slot1: Date | null; slot2: Date | null } {
  const ticks = utcTicks(
    new Date(deadline.getTime() - 5 * MS_PER_DAY),
    new Date(deadline.getTime() + MS_PER_DAY),
  );
  let slot1: Date | null = null;
  let slot2: Date | null = null;

  for (const now of ticks) {
    for (const slot of [1, 2] as const) {
      const alreadySentAt = slot === 1 ? slot1 : slot2;
      const decision = shouldSendWeeklyReminder({
        slot,
        deadline,
        now,
        alreadySentAt,
      });
      if (decision.send) {
        if (slot === 1) {
          slot1 = now;
        } else {
          slot2 = now;
        }
        break;
      }
    }
  }

  return { slot1, slot2 };
}

describe("REMINDER_SLOT_LEAD_HOURS", () => {
  it("anchors slot 1 at 48h and slot 2 at 12h", () => {
    expect(REMINDER_SLOT_LEAD_HOURS).toEqual({ 1: 48, 2: 12 });
  });
});

describe("isPastPickDeadline", () => {
  it("is false when deadline is null", () => {
    expect(isPastPickDeadline(null, WEEK_1_DEADLINE)).toBe(false);
  });

  it("is false exactly at the deadline (strict >)", () => {
    expect(isPastPickDeadline(WEEK_1_DEADLINE, WEEK_1_DEADLINE)).toBe(false);
  });

  it("is true one millisecond after the deadline", () => {
    expect(
      isPastPickDeadline(WEEK_1_DEADLINE, new Date(WEEK_1_DEADLINE.getTime() + 1)),
    ).toBe(true);
  });
});

describe("shouldSendWeeklyReminder — I/O matrix (Week 1 Wed 2026-09-09 20:10 ET)", () => {
  it("Slot 1 due — first tick at or after deadline − 48h", () => {
    expect(
      shouldSendWeeklyReminder({
        slot: 1,
        deadline: WEEK_1_DEADLINE,
        now: easternLocal(2026, 8, 8, 7, 0),
        alreadySentAt: null,
      }),
    ).toEqual({ send: true });
  });

  it("Slot 1 too early — before deadline − 48h", () => {
    expect(
      shouldSendWeeklyReminder({
        slot: 1,
        deadline: WEEK_1_DEADLINE,
        now: easternLocal(2026, 8, 7, 16, 0),
        alreadySentAt: null,
      }),
    ).toEqual({ send: false, reason: "not_due" });
  });

  it("Repeat tick — already stamped", () => {
    expect(
      shouldSendWeeklyReminder({
        slot: 1,
        deadline: WEEK_1_DEADLINE,
        now: easternLocal(2026, 8, 8, 16, 0),
        alreadySentAt: easternLocal(2026, 8, 8, 7, 0),
      }),
    ).toEqual({ send: false, reason: "already_sent" });
  });

  it("Slot 2 due — first tick at or after deadline − 12h", () => {
    expect(
      shouldSendWeeklyReminder({
        slot: 2,
        deadline: WEEK_1_DEADLINE,
        now: easternLocal(2026, 8, 9, 16, 0),
        alreadySentAt: null,
      }),
    ).toEqual({ send: true });
  });

  it("Past deadline — never send", () => {
    expect(
      shouldSendWeeklyReminder({
        slot: 1,
        deadline: WEEK_1_DEADLINE,
        now: easternLocal(2026, 8, 9, 20, 11),
        alreadySentAt: null,
      }),
    ).toEqual({ send: false, reason: "past_deadline" });
    expect(
      shouldSendWeeklyReminder({
        slot: 2,
        deadline: WEEK_1_DEADLINE,
        now: easternLocal(2026, 8, 9, 20, 11),
        alreadySentAt: null,
      }),
    ).toEqual({ send: false, reason: "past_deadline" });
  });

  it("Exactly at deadline — still send (strict >)", () => {
    expect(
      shouldSendWeeklyReminder({
        slot: 2,
        deadline: WEEK_1_DEADLINE,
        now: WEEK_1_DEADLINE,
        alreadySentAt: null,
      }),
    ).toEqual({ send: true });
  });

  it("No schedule data — missing_deadline, never throws", () => {
    expect(
      shouldSendWeeklyReminder({
        slot: 1,
        deadline: null,
        now: easternLocal(2026, 8, 8, 7, 0),
        alreadySentAt: null,
      }),
    ).toEqual({ send: false, reason: "missing_deadline" });
  });

  it("late deploy: at a slot-2 tick, unsent slot 1 is still due", () => {
    expect(
      shouldSendWeeklyReminder({
        slot: 1,
        deadline: WEEK_1_DEADLINE,
        now: easternLocal(2026, 8, 9, 16, 0),
        alreadySentAt: null,
      }),
    ).toEqual({ send: true });
  });
});

describe("summarizeReminderSkip", () => {
  it("ranks schedule problems above lock state above routine skips", () => {
    expect(summarizeReminderSkip(["not_due", "already_sent", "past_deadline"])).toBe(
      "past_deadline",
    );
    expect(summarizeReminderSkip(["not_due", "already_sent"])).toBe("already_sent");
    expect(summarizeReminderSkip(["not_due"])).toBe("not_due");
    expect(summarizeReminderSkip([])).toBeNull();
  });
});

describe("2026 season tick sweep", () => {
  it("fires exactly one slot 1 and one slot 2 before the deadline for every week", () => {
    expect(SEASON_2026_OPENERS).toHaveLength(18);

    const expectedEt: Record<number, { slot1: string; slot2: string }> = {
      1: { slot1: "2026-09-08 07:00", slot2: "2026-09-09 16:00" },
      2: { slot1: "2026-09-16 07:00", slot2: "2026-09-17 16:00" },
      12: { slot1: "2026-11-24 06:00", slot2: "2026-11-25 15:00" },
      18: { slot1: "2027-01-08 15:00", slot2: "2027-01-10 06:00" },
    };

    for (const opener of SEASON_2026_OPENERS) {
      const deadline = computePickDeadlineUtc(opener.kickoffAt);
      const { slot1, slot2 } = replaySlots(deadline);

      expect(slot1, `week ${opener.weekNumber} slot 1`).not.toBeNull();
      expect(slot2, `week ${opener.weekNumber} slot 2`).not.toBeNull();
      expect(slot1!.getTime(), `week ${opener.weekNumber} slot 1 before deadline`).toBeLessThanOrEqual(
        deadline.getTime(),
      );
      expect(slot2!.getTime(), `week ${opener.weekNumber} slot 2 before deadline`).toBeLessThanOrEqual(
        deadline.getTime(),
      );
      expect(slot1!.getTime(), `week ${opener.weekNumber} distinct ticks`).not.toBe(
        slot2!.getTime(),
      );

      const pinned = expectedEt[opener.weekNumber];
      if (pinned) {
        expect(easternWall(slot1!), `week ${opener.weekNumber} slot 1 ET`).toBe(pinned.slot1);
        expect(easternWall(slot2!), `week ${opener.weekNumber} slot 2 ET`).toBe(pinned.slot2);
      }
    }
  });
});
