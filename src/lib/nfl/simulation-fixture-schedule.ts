import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";
import fixtureSchedule from "../../../prisma/data/nfl-simulation-fixture-schedule.json";

export type FixtureMatchup = { home: string; away: string };

export type FixtureWeek = { games: FixtureMatchup[] };

const fixtureWeeks = fixtureSchedule as FixtureWeek[];

/**
 * Select fixture matchups for a simulated week via modulo cycling over the fixture file.
 * `weekNumber` is 1-based (NFL / simulation convention).
 */
export function selectFixtureMatchups(weekNumber: number): FixtureMatchup[] {
  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    throw new Error(`selectFixtureMatchups: weekNumber must be an integer >= 1, got ${weekNumber}`);
  }
  if (fixtureWeeks.length === 0) {
    throw new Error("selectFixtureMatchups: fixture schedule is empty");
  }
  const idx = (weekNumber - 1) % fixtureWeeks.length;
  return fixtureWeeks[idx]!.games;
}

/** Exposed for structural-integrity tests. */
export function getFixtureScheduleWeeks(): FixtureWeek[] {
  return fixtureWeeks;
}

/**
 * Build future-safe kickoff times for a newly created fixture week (Story 8.3 AC2 +
 * full-volume fixtures).
 *
 * Earliest game: **20:20 America/New_York** on the next calendar Thursday that is at least
 * 3 full days after `anchorNow`. Remaining games fill a realistic NFL card order relative to
 * that Thursday — Sun early (13:00+ staggered), Sun late (16:05/16:25+), Sun night 20:20,
 * Mon 20:15 — with minute offsets so every returned instant is pairwise distinct for
 * `gameCount` up to 16 (no modulo recycling of identical timestamps).
 */
export function buildFixtureKickoffTimes(anchorNow: Date, gameCount: number): Date[] {
  if (!Number.isInteger(gameCount) || gameCount < 0) {
    throw new Error(
      `buildFixtureKickoffTimes: gameCount must be an integer 0–16, got ${String(gameCount)}`,
    );
  }
  if (gameCount === 0) {
    return [];
  }
  if (gameCount > 16) {
    throw new Error(`buildFixtureKickoffTimes: gameCount must be <= 16, got ${gameCount}`);
  }

  const thursdayYmd = findNextThursdayAtLeastThreeDaysOut(anchorNow);
  const [ty, tm, td] = thursdayYmd.split("-").map((x) => parseInt(x, 10));

  const thursdayNoon = fromZonedTime(
    new Date(ty!, tm! - 1, td!, 12, 0, 0),
    LEAGUE_BUSINESS_TIMEZONE,
  );
  const sundayNoon = addDays(thursdayNoon, 3);
  const mondayNoon = addDays(thursdayNoon, 4);

  const sunYmd = formatInTimeZone(sundayNoon, LEAGUE_BUSINESS_TIMEZONE, "yyyy-MM-dd");
  const monYmd = formatInTimeZone(mondayNoon, LEAGUE_BUSINESS_TIMEZONE, "yyyy-MM-dd");
  const [sy, sm, sd] = sunYmd.split("-").map((x) => parseInt(x, 10));
  const [my, mm, md] = monYmd.split("-").map((x) => parseInt(x, 10));

  const et = (y: number, m: number, d: number, hour: number, minute: number) =>
    fromZonedTime(new Date(y, m - 1, d, hour, minute, 0), LEAGUE_BUSINESS_TIMEZONE);

  // Order mirrors a typical NFL week; early/late Sunday windows stagger by 5 minutes so
  // full-volume cards (13–16 games) never share an identical kickoffAt.
  const slots: Date[] = [
    et(ty!, tm!, td!, 20, 20), // Thu night
    et(sy!, sm!, sd!, 13, 0),
    et(sy!, sm!, sd!, 13, 5),
    et(sy!, sm!, sd!, 13, 10),
    et(sy!, sm!, sd!, 13, 15),
    et(sy!, sm!, sd!, 13, 20),
    et(sy!, sm!, sd!, 13, 25),
    et(sy!, sm!, sd!, 13, 30),
    et(sy!, sm!, sd!, 13, 35),
    et(sy!, sm!, sd!, 16, 5),
    et(sy!, sm!, sd!, 16, 25),
    et(sy!, sm!, sd!, 16, 30),
    et(sy!, sm!, sd!, 16, 35),
    et(sy!, sm!, sd!, 20, 20), // Sun night
    et(my!, mm!, md!, 20, 15), // Mon night
    et(my!, mm!, md!, 20, 20), // second Mon slot if a 16-game card needs it
  ];

  return slots.slice(0, gameCount);
}

/**
 * Next America/New_York calendar Thursday whose **20:20 ET kickoff instant** is strictly after
 * `anchorNow + 3 days` (3 full days out).
 *
 * Matching the calendar day alone is not sufficient: if `anchorNow`'s ET time-of-day is already
 * past 20:20, the same-calendar-day Thursday's 20:20 kickoff can fall *before* the 3-full-days
 * floor even though its calendar date is correct — so each Thursday candidate's actual kickoff
 * instant is checked, and the search continues to the following Thursday when it isn't late enough.
 */
function findNextThursdayAtLeastThreeDaysOut(anchorNow: Date): string {
  const earliestInstantMs = anchorNow.getTime() + 3 * 24 * 60 * 60 * 1000;
  let cursor = new Date(earliestInstantMs);
  for (let i = 0; i < 15; i++) {
    // date-fns-tz `i`: ISO day of week, 1=Monday … 7=Sunday; Thursday = 4
    if (formatInTimeZone(cursor, LEAGUE_BUSINESS_TIMEZONE, "i") === "4") {
      const ymd = formatInTimeZone(cursor, LEAGUE_BUSINESS_TIMEZONE, "yyyy-MM-dd");
      const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
      const candidateKickoff = fromZonedTime(
        new Date(y!, m! - 1, d!, 20, 20, 0),
        LEAGUE_BUSINESS_TIMEZONE,
      );
      if (candidateKickoff.getTime() > earliestInstantMs) {
        return ymd;
      }
    }
    cursor = addDays(cursor, 1);
  }
  throw new Error("findNextThursdayAtLeastThreeDaysOut: failed to locate a Thursday within 15 days");
}
