import { describe, expect, it } from "vitest";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";

import {
  PICK_DEADLINE_LEAD_MINUTES,
  computePickDeadlineUtc,
  getFirstKickoffUtc,
  isNflWeekPickWindowClosedByDeadline,
  isLeagueWeekPickWindowClosed,
} from "./pick-deadline";

const TZ = LEAGUE_BUSINESS_TIMEZONE;

/** Wall clock in `America/New_York` → UTC `Date` (for fixed test vectors). */
function easternLocal(y: number, m0: number, d: number, h: number, min: number): Date {
  return fromZonedTime(new Date(y, m0, d, h, min, 0), TZ);
}

/** `America/New_York` wall clock of `at`, as `yyyy-MM-dd HH:mm` + ISO weekday. */
function eastern(at: Date): { wall: string; isoWeekday: string } {
  return {
    wall: formatInTimeZone(at, TZ, "yyyy-MM-dd HH:mm"),
    isoWeekday: formatInTimeZone(at, TZ, "i"),
  };
}

describe("PICK_DEADLINE_LEAD_MINUTES", () => {
  it("encodes the five-minute FR26 lead", () => {
    expect(PICK_DEADLINE_LEAD_MINUTES).toBe(5);
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
  it("is firstKickoff minus five minutes with no weekday anchor", () => {
    const kickoff = easternLocal(2026, 8, 9, 20, 15);
    expect(computePickDeadlineUtc(kickoff).getTime()).toBe(kickoff.getTime() - 5 * 60 * 1000);
  });

  // FR26 / NFR24: the deadline tracks each week's own opener regardless of its weekday. The
  // pre-2026-09-02 rule walked back to the Thursday on or before the opener, which fell into the
  // *previous* game week for Wednesday openers (six-day early lockout) and had no competitive
  // meaning in weeks with no Thursday game at all.
  it.each([
    {
      label: "Wednesday opener (2026 Week 1, NE@SEA)",
      kickoff: easternLocal(2026, 8, 9, 20, 15),
      expected: "2026-09-09 20:10",
    },
    {
      label: "Wednesday opener (2026 Week 12, Thanksgiving week)",
      kickoff: easternLocal(2026, 10, 25, 20, 0),
      expected: "2026-11-25 19:55",
    },
    {
      label: "Sunday opener, no Thursday game (2026 Week 18)",
      kickoff: easternLocal(2027, 0, 10, 13, 0),
      expected: "2027-01-10 12:55",
    },
    {
      label: "Thursday Night Football opener",
      kickoff: easternLocal(2026, 8, 17, 20, 15),
      expected: "2026-09-17 20:10",
    },
  ])("$label locks at $expected ET", ({ kickoff, expected }) => {
    expect(eastern(computePickDeadlineUtc(kickoff)).wall).toBe(expected);
  });

  // Schedule *shapes* the rule has to survive, using a synthetic year so they can never be mistaken
  // for real 2026 fixtures — the 2026 table above already fixes every opener that season.
  it.each([
    {
      label: "Saturday opener",
      kickoff: easternLocal(2030, 11, 21, 13, 0),
      expected: "2030-12-21 12:55",
    },
    {
      label: "London 09:30 ET international opener",
      kickoff: easternLocal(2030, 9, 6, 9, 30),
      expected: "2030-10-06 09:25",
    },
  ])("hypothetical $label locks at $expected ET", ({ kickoff, expected }) => {
    expect(eastern(computePickDeadlineUtc(kickoff)).wall).toBe(expected);
  });

  it("locks every 2026 Thursday-opener week at Thursday 20:10 ET — the 15 weeks left unchanged", () => {
    // Weeks 2–11 and 13–17 of the 2026 season all open with TNF at 20:15 ET. Thursdays run Sep 17 →
    // Nov 19, then Dec 3 → Dec 31 (Week 12 opens Wed Nov 25).
    //
    // The old rule cannot be called here — it was deleted in the same change — so this asserts the
    // value it produced rather than the function. For a Thursday 20:15 opener the old
    // min(kickoff − 5m, Thursday 20:10 ET) collapsed to that same Thursday 20:10, so landing on
    // 20:10 *is* agreement with it. That is what scopes the rule change to Weeks 1, 12 and 18.
    const thursdays = [
      easternLocal(2026, 8, 17, 20, 15),
      easternLocal(2026, 8, 24, 20, 15),
      easternLocal(2026, 9, 1, 20, 15),
      easternLocal(2026, 9, 8, 20, 15),
      easternLocal(2026, 9, 15, 20, 15),
      easternLocal(2026, 9, 22, 20, 15),
      easternLocal(2026, 9, 29, 20, 15),
      easternLocal(2026, 10, 5, 20, 15),
      easternLocal(2026, 10, 12, 20, 15),
      easternLocal(2026, 10, 19, 20, 15),
      easternLocal(2026, 11, 3, 20, 15),
      easternLocal(2026, 11, 10, 20, 15),
      easternLocal(2026, 11, 17, 20, 15),
      easternLocal(2026, 11, 24, 20, 15),
      easternLocal(2026, 11, 31, 20, 15),
    ];
    expect(thursdays).toHaveLength(15);

    for (const kickoff of thursdays) {
      const kick = eastern(kickoff);
      const deadline = eastern(computePickDeadlineUtc(kickoff));
      const [kickDate, kickTime] = kick.wall.split(" ");
      expect(kick.isoWeekday).toBe("4");
      expect(kickTime).toBe("20:15");
      expect(deadline.isoWeekday).toBe("4");
      expect(deadline.wall).toBe(`${kickDate} 20:10`);
    }
  });

  it("moves the three affected 2026 weeks later, never earlier (NFR24)", () => {
    // Only Weeks 1, 12 and 18 change at all; the other 15 are equal to the old value, asserted
    // above. Every week that does move goes *later*, which is the direction NFR24 protects.
    const cases = [
      { kickoff: easternLocal(2026, 8, 9, 20, 15), priorRule: easternLocal(2026, 8, 3, 20, 10) },
      { kickoff: easternLocal(2026, 10, 25, 20, 0), priorRule: easternLocal(2026, 10, 19, 20, 10) },
      { kickoff: easternLocal(2027, 0, 10, 13, 0), priorRule: easternLocal(2027, 0, 7, 20, 10) },
    ];
    for (const { kickoff, priorRule } of cases) {
      expect(computePickDeadlineUtc(kickoff).getTime()).toBeGreaterThan(priorRule.getTime());
    }
  });

  it("stays strictly before the first kickoff", () => {
    const kickoff = easternLocal(2026, 8, 9, 20, 15);
    expect(computePickDeadlineUtc(kickoff).getTime()).toBeLessThan(kickoff.getTime());
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

  it("anchors on the week's earliest kickoff, not the earliest listed one", () => {
    const wed = easternLocal(2026, 8, 9, 20, 15);
    const sun = easternLocal(2026, 8, 13, 13, 0);
    const games = [{ kickoffAt: sun }, { kickoffAt: wed }];
    expect(
      isNflWeekPickWindowClosedByDeadline({ at: easternLocal(2026, 8, 9, 20, 11), games }),
    ).toBe(true);
    expect(
      isNflWeekPickWindowClosedByDeadline({ at: easternLocal(2026, 8, 9, 20, 9), games }),
    ).toBe(false);
  });
});

describe("isLeagueWeekPickWindowClosed", () => {
  const futureKickoff = new Date("2026-09-11T20:00:00.000Z");
  const nowBeforeKickoff = new Date("2026-08-26T16:00:00.000Z");
  const games = [{ kickoffAt: futureKickoff }];

  it("keeps a test-league current week locked when kickoffs are still in the future", () => {
    expect(
      isLeagueWeekPickWindowClosed({
        at: nowBeforeKickoff,
        weekNumber: 2,
        games,
        isTestLeague: true,
        simulatedCurrentWeek: 2,
      }),
    ).toBe(false);
  });

  it("closes prior test-league weeks once the sim pointer has advanced", () => {
    expect(
      isLeagueWeekPickWindowClosed({
        at: nowBeforeKickoff,
        weekNumber: 1,
        games,
        isTestLeague: true,
        simulatedCurrentWeek: 2,
      }),
    ).toBe(true);
  });

  it("does not use the sim pointer for live leagues", () => {
    expect(
      isLeagueWeekPickWindowClosed({
        at: nowBeforeKickoff,
        weekNumber: 1,
        games,
        isTestLeague: false,
        simulatedCurrentWeek: 2,
      }),
    ).toBe(false);
  });
});
