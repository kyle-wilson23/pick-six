import { describe, expect, it } from "vitest";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";

import {
  THURSDAY_LOCK_HOUR,
  THURSDAY_LOCK_MINUTE,
  computePickDeadlineUtc,
  getFirstKickoffUtc,
  isNflWeekPickWindowClosedByDeadline,
  lockByFirstGameUtc,
  lockByThursdayDefaultUtc,
} from "./pick-deadline";

const TZ = LEAGUE_BUSINESS_TIMEZONE;

/** Wall clock in `America/New_York` → UTC `Date` (for fixed test vectors). */
function easternLocal(y: number, m0: number, d: number, h: number, min: number): Date {
  return fromZonedTime(new Date(y, m0, d, h, min, 0), TZ);
}

describe("Thursday lockout constants", () => {
  it("THURSDAY_LOCK_HOUR and THURSDAY_LOCK_MINUTE encode 8:10 PM (FR26)", () => {
    expect(THURSDAY_LOCK_HOUR).toBe(20);
    expect(THURSDAY_LOCK_MINUTE).toBe(10);
  });

  it("lockByThursdayDefaultUtc returns a date at THURSDAY_LOCK_HOUR:THURSDAY_LOCK_MINUTE in the league timezone", () => {
    // Oct 10 2024 is a Thursday
    const thuKickoff = easternLocal(2024, 9, 10, 20, 20);
    const lock = lockByThursdayDefaultUtc(thuKickoff, TZ);
    const h = parseInt(formatInTimeZone(lock, TZ, "H"), 10);
    const min = parseInt(formatInTimeZone(lock, TZ, "m"), 10);
    expect(h).not.toBeNaN();
    expect(min).not.toBeNaN();
    expect(h).toBe(THURSDAY_LOCK_HOUR);
    expect(min).toBe(THURSDAY_LOCK_MINUTE);
  });
});

describe("getFirstKickoffUtc", () => {
  it("returns the minimum kickoff and null when any is missing or empty", () => {
    const a = new Date("2024-10-10T00:00:00.000Z");
    const b = new Date("2024-10-12T00:00:00.000Z");
    expect(getFirstKickoffUtc([{ kickoffAt: a }, { kickoffAt: b }])).toEqual(a);
    expect(getFirstKickoffUtc([])).toBeNull();
    expect(getFirstKickoffUtc([{ kickoffAt: a }, { kickoffAt: null }])).toBeNull();
  });
});

describe("computePickDeadlineUtc", () => {
  it("TNF 8:20 PM Eastern: Thursday default 8:10 is stricter than first-game minus five minutes (8:15)", () => {
    const tnf = easternLocal(2024, 9, 10, 20, 20);
    const byFirst = lockByFirstGameUtc(tnf);
    const byThu = lockByThursdayDefaultUtc(tnf, TZ);
    expect(byFirst.getTime()).toBe(tnf.getTime() - 5 * 60 * 1000);
    expect(byThu < byFirst).toBe(true);
    const d = computePickDeadlineUtc(tnf);
    expect(d.getTime()).toBe(byThu.getTime());
  });

  it("Sunday-first: Thursday 8:10 PM is earlier in the week than Sunday 1:00 PM first kickoff minus 5m", () => {
    const sunday = easternLocal(2024, 9, 13, 13, 0);
    const d = computePickDeadlineUtc(sunday);
    const thu = lockByThursdayDefaultUtc(sunday, TZ);
    expect(d.getTime()).toBe(thu.getTime());
    expect(d.getTime() < lockByFirstGameUtc(sunday).getTime()).toBe(true);
  });

  it("Thursday early kickoff: first-game minus 5m beats Thursday 8:10 PM — lockByFirstGame wins", () => {
    // Oct 10 2024 is a Thursday. A 7:00 PM Eastern kickoff → lockByFirst = 6:55 PM < 8:10 PM Thursday.
    const earlyThu = easternLocal(2024, 9, 10, 19, 0);
    const byFirst = lockByFirstGameUtc(earlyThu);
    const byThu = lockByThursdayDefaultUtc(earlyThu, TZ);
    expect(byFirst.getTime() < byThu.getTime()).toBe(true);
    const d = computePickDeadlineUtc(earlyThu);
    expect(d.getTime()).toBe(byFirst.getTime());
  });

  it("reuses the on-or-before Thursday (same day as a Thursday TNF) for the 8:10 leg", () => {
    const thuTnf = easternLocal(2024, 9, 3, 20, 15);
    const thLock = lockByThursdayDefaultUtc(thuTnf, TZ);
    expect(formatInTimeZone(thLock, TZ, "yyyy-MM-dd")).toBe(
      formatInTimeZone(thuTnf, TZ, "yyyy-MM-dd"),
    );
  });
});

describe("isNflWeekPickWindowClosedByDeadline", () => {
  it("is false at the deadline instant and true strictly after (NFR24)", () => {
    const k = easternLocal(2024, 9, 13, 13, 0);
    const deadline = computePickDeadlineUtc(k);
    const games = [{ kickoffAt: k }];
    expect(isNflWeekPickWindowClosedByDeadline({ at: new Date(deadline.getTime() - 1), games })).toBe(
      false,
    );
    expect(isNflWeekPickWindowClosedByDeadline({ at: deadline, games })).toBe(false);
    expect(isNflWeekPickWindowClosedByDeadline({ at: new Date(deadline.getTime() + 1), games })).toBe(
      true,
    );
  });
});
