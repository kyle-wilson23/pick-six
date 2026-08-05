import { describe, expect, it } from "vitest";

import { computePickDeadlineUtc } from "@/lib/domain/pick-deadline";
import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";
import {
  buildFixtureKickoffTimes,
  getFixtureScheduleWeeks,
  selectFixtureMatchups,
} from "@/lib/nfl/simulation-fixture-schedule";
import nflTeams from "../../../prisma/data/nfl-teams.json";
import { formatInTimeZone } from "date-fns-tz";

const validAbbreviations = new Set(nflTeams.map((t) => t.abbreviation));

describe("nfl-simulation-fixture-schedule.json structural integrity", () => {
  const weeks = getFixtureScheduleWeeks();

  it("has at least 6 fixture weeks", () => {
    expect(weeks.length).toBeGreaterThanOrEqual(6);
  });

  it("each week has 13–16 games, valid abbreviations, and no repeated team", () => {
    for (const [weekIdx, week] of weeks.entries()) {
      expect(week.games.length, `week ${weekIdx}`).toBeGreaterThanOrEqual(13);
      expect(week.games.length, `week ${weekIdx}`).toBeLessThanOrEqual(16);
      const seen = new Set<string>();
      for (const g of week.games) {
        expect(validAbbreviations.has(g.home), `unknown home ${g.home}`).toBe(true);
        expect(validAbbreviations.has(g.away), `unknown away ${g.away}`).toBe(true);
        expect(g.home).not.toBe(g.away);
        expect(seen.has(g.home), `duplicate ${g.home} in week ${weekIdx}`).toBe(false);
        expect(seen.has(g.away), `duplicate ${g.away} in week ${weekIdx}`).toBe(false);
        seen.add(g.home);
        seen.add(g.away);
      }
    }
  });
});

describe("selectFixtureMatchups", () => {
  it("cycles via modulo across week numbers 1–18", () => {
    const weeks = getFixtureScheduleWeeks();
    for (let w = 1; w <= 18; w++) {
      const matchups = selectFixtureMatchups(w);
      expect(matchups).toEqual(weeks[(w - 1) % weeks.length]!.games);
    }
  });

  it("rejects non-positive week numbers", () => {
    expect(() => selectFixtureMatchups(0)).toThrow();
    expect(() => selectFixtureMatchups(-1)).toThrow();
  });

  it("rejects non-integer week numbers", () => {
    expect(() => selectFixtureMatchups(1.5)).toThrow();
  });
});

describe("buildFixtureKickoffTimes", () => {
  it("places every kickoff after now + 3 days and keeps pick deadline after now", () => {
    const now = new Date("2026-07-20T15:00:00.000Z");
    const times = buildFixtureKickoffTimes(now, 4);
    expect(times).toHaveLength(4);

    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    for (const t of times) {
      expect(t.getTime()).toBeGreaterThan(now.getTime() + threeDaysMs - 1);
    }

    const first = times[0]!;
    expect(formatInTimeZone(first, LEAGUE_BUSINESS_TIMEZONE, "i")).toBe("4"); // Thursday
    expect(formatInTimeZone(first, LEAGUE_BUSINESS_TIMEZONE, "HH:mm")).toBe("20:20");

    const deadline = computePickDeadlineUtc(first);
    expect(deadline.getTime()).toBeGreaterThan(now.getTime());
  });

  it("starts with Thu night then staggered Sunday early windows for a 4-game card", () => {
    const now = new Date("2026-07-20T15:00:00.000Z");
    const times = buildFixtureKickoffTimes(now, 4);
    expect(formatInTimeZone(times[1]!, LEAGUE_BUSINESS_TIMEZONE, "i HH:mm")).toBe("7 13:00");
    expect(formatInTimeZone(times[2]!, LEAGUE_BUSINESS_TIMEZONE, "i HH:mm")).toBe("7 13:05");
    expect(formatInTimeZone(times[3]!, LEAGUE_BUSINESS_TIMEZONE, "i HH:mm")).toBe("7 13:10");
  });

  it("returns 16 pairwise-distinct kickoffs spanning Sun late / night and Mon for a full card", () => {
    const now = new Date("2026-07-20T15:00:00.000Z");
    const times = buildFixtureKickoffTimes(now, 16);
    expect(times).toHaveLength(16);

    const ms = times.map((t) => t.getTime());
    expect(new Set(ms).size).toBe(16);

    expect(formatInTimeZone(times[0]!, LEAGUE_BUSINESS_TIMEZONE, "i HH:mm")).toBe("4 20:20");
    expect(formatInTimeZone(times[9]!, LEAGUE_BUSINESS_TIMEZONE, "i HH:mm")).toBe("7 16:05");
    expect(formatInTimeZone(times[13]!, LEAGUE_BUSINESS_TIMEZONE, "i HH:mm")).toBe("7 20:20");
    expect(formatInTimeZone(times[14]!, LEAGUE_BUSINESS_TIMEZONE, "i HH:mm")).toBe("1 20:15");

    const deadline = computePickDeadlineUtc(times[0]!);
    expect(deadline.getTime()).toBeGreaterThan(now.getTime());
  });

  it("returns pairwise-distinct kickoffs for gameCount 4", () => {
    const now = new Date("2026-07-20T15:00:00.000Z");
    const times = buildFixtureKickoffTimes(now, 4);
    expect(new Set(times.map((t) => t.getTime())).size).toBe(4);
  });

  it("rejects non-integer and out-of-range gameCount", () => {
    const now = new Date("2026-07-20T15:00:00.000Z");
    expect(buildFixtureKickoffTimes(now, 0)).toEqual([]);
    expect(() => buildFixtureKickoffTimes(now, 1.5)).toThrow(/integer/);
    expect(() => buildFixtureKickoffTimes(now, NaN)).toThrow(/integer/);
    expect(() => buildFixtureKickoffTimes(now, 17)).toThrow(/<= 16/);
  });

  it("skips to a later Thursday when the nearest Thursday is within 3 days", () => {
    // Tuesday → earliest allowed is Friday → next Thursday is ~5 days later
    const now = new Date("2026-07-21T15:00:00.000Z"); // Tuesday
    const times = buildFixtureKickoffTimes(now, 1);
    const first = times[0]!;
    expect(formatInTimeZone(first, LEAGUE_BUSINESS_TIMEZONE, "yyyy-MM-dd")).toBe("2026-07-30");
  });

  it("skips to the following Thursday when +3-days lands on Thursday evening after 20:20 ET", () => {
    // Monday 2026-07-20 23:00 ET → +3 days = Thursday 2026-07-23 23:00 ET, which is already
    // past that same Thursday's 20:20 ET kickoff slot — must not return a kickoff that is
    // less than 3 full days out.
    const now = new Date("2026-07-21T03:00:00.000Z"); // Monday 23:00 ET (EDT, UTC-4)
    const times = buildFixtureKickoffTimes(now, 1);
    const first = times[0]!;

    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    expect(first.getTime()).toBeGreaterThan(now.getTime() + threeDaysMs);
    expect(formatInTimeZone(first, LEAGUE_BUSINESS_TIMEZONE, "yyyy-MM-dd")).toBe("2026-07-30");
  });
});
