/**
 * Pure resolution of which NFL regular-season week the picks UX should show (Story 3.6 / 8.2) and
 * when that week's pick window opens (FR26a).
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { computePickDeadlineUtc } from "@/lib/domain/pick-deadline";
import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";

export type MinimalSeasonForPicksWeek = {
  preSeasonInitializedAt: Date | null;
  firstCompetitionWeek: number;
  /** Story 8.2 — present when resolving via `resolveActiveWeekNumber` for test leagues. */
  simulatedCurrentWeek?: number | null;
} | null;

export type MinimalNflGameForPicksWeek = {
  weekNumber: number;
  kickoffAt: Date;
};

/**
 * Returns the NFL week index to surface on the picks page.
 *
 * Algorithm (Dev Notes Story 3.6):
 * 1. No season row or not initialized → `first_competition_week` (default 1).
 * 2. Season initialized, has games:
 *    a. Lowest `weekNumber` with any future kickoff: if `< firstCompetitionWeek` → clamp to FCW (preview mid-season-start); else active week.
 *    b. If all kickoffs past → highest week among games with data (post-season viewing).
 * 3. No `NflGame` rows → FCW fallback.
 */
export function resolvePicksWeekNumber(
  season: MinimalSeasonForPicksWeek,
  gamesForYear: MinimalNflGameForPicksWeek[],
  now: Date = new Date(),
): number {
  const fcw =
    typeof season?.firstCompetitionWeek === "number"
      ? season.firstCompetitionWeek
      : 1;

  if (gamesForYear.length === 0) {
    return fcw;
  }

  if (!season || season.preSeasonInitializedAt == null) {
    return fcw;
  }

  const futureGames = gamesForYear.filter((g) => g.kickoffAt.getTime() > now.getTime());
  if (futureGames.length > 0) {
    const minWeek = Math.min(...futureGames.map((g) => g.weekNumber));
    if (minWeek < fcw) {
      return fcw;
    }
    return minWeek;
  }

  const maxWeek = Math.max(...gamesForYear.map((g) => g.weekNumber));
  return Number.isFinite(maxWeek) ? maxWeek : fcw;
}

/**
 * Dispatcher for participant/admin "current week" (Story 8.2).
 *
 * - Test league with `simulatedCurrentWeek` set → use the simulation clock.
 * - Otherwise (production, or test league not started) → kickoff-based `resolvePicksWeekNumber`.
 *
 * Production path is a pure passthrough (AC5 / AC8).
 */
export function resolveActiveWeekNumber(args: {
  isTestLeague: boolean;
  season: MinimalSeasonForPicksWeek;
  gamesForYear: MinimalNflGameForPicksWeek[];
  now?: Date;
}): number {
  const { isTestLeague, season, gamesForYear, now = new Date() } = args;
  if (isTestLeague && season?.simulatedCurrentWeek != null) {
    return season.simulatedCurrentWeek;
  }
  return resolvePicksWeekNumber(season, gamesForYear, now);
}

/** FR26a: a game week starts at Tuesday 00:00 in `LEAGUE_BUSINESS_TIMEZONE` (ISO weekday 2). */
const GAME_WEEK_START_ISO_WEEKDAY = 2;

/** FR26a: the league's first competition week opens this far ahead of its own first kickoff. */
export const FIRST_COMPETITION_WEEK_OPEN_LEAD_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Earliest kickoff among `games` for `weekNumber`, or `null` when that week has no games. */
function firstKickoffForWeek(
  games: { weekNumber: number; kickoffAt: Date }[],
  weekNumber: number,
): Date | null {
  let earliest: Date | null = null;
  for (const g of games) {
    if (g.weekNumber !== weekNumber) {
      continue;
    }
    if (earliest == null || g.kickoffAt.getTime() < earliest.getTime()) {
      earliest = g.kickoffAt;
    }
  }
  return earliest;
}

/**
 * Calendar date `days` before `at`, as `yyyy-MM-dd` in `timeZone`.
 *
 * Steps from midday so a whole-day shift stays within an hour of midday across any DST transition
 * and can never resolve to the wrong calendar day. Dates are round-tripped as zoned strings rather
 * than `new Date(y, m, d)`, so nothing here depends on the host machine's timezone.
 */
function zonedCalendarDateMinusDays(at: Date, days: number, timeZone: string): string {
  const ymd = formatInTimeZone(at, timeZone, "yyyy-MM-dd");
  const midday = fromZonedTime(`${ymd}T12:00:00`, timeZone);
  return formatInTimeZone(new Date(midday.getTime() - days * MS_PER_DAY), timeZone, "yyyy-MM-dd");
}

/**
 * Tuesday 00:00 in `timeZone` on the calendar Tuesday **on or before** the `timeZone` calendar day
 * of `kickoff` (inclusive) — the start of the game week containing that kickoff.
 */
function gameWeekStartUtc(kickoff: Date, timeZone: string): Date {
  const isoWeekday = parseInt(formatInTimeZone(kickoff, timeZone, "i"), 10);
  const daysSinceWeekStart = (isoWeekday - GAME_WEEK_START_ISO_WEEKDAY + 7) % 7;
  const ymd = zonedCalendarDateMinusDays(kickoff, daysSinceWeekStart, timeZone);
  return fromZonedTime(`${ymd}T00:00:00`, timeZone);
}

/**
 * `firstKickoff` shifted back `FIRST_COMPETITION_WEEK_OPEN_LEAD_DAYS` calendar days, keeping the
 * same `timeZone` wall clock — so a 20:15 ET kickoff opens at 20:15 ET a week earlier even when a
 * DST transition falls inside the span.
 */
function openLeadBeforeKickoff(firstKickoff: Date, timeZone: string): Date {
  const timeOfDay = formatInTimeZone(firstKickoff, timeZone, "HH:mm:ss");
  const ymd = zonedCalendarDateMinusDays(
    firstKickoff,
    FIRST_COMPETITION_WEEK_OPEN_LEAD_DAYS,
    timeZone,
  );
  return fromZonedTime(`${ymd}T${timeOfDay}`, timeZone);
}

/**
 * FR26a: the instant a league week's pick window opens, or `null` when the week has no schedule
 * data to anchor on.
 *
 * - League's **first** competition week → `firstKickoff − 7 days`, so a season that opens on a
 *   Wednesday still gets a full week of pick time.
 * - Any later week → Tuesday 00:00 ET of the game week containing that week's first kickoff.
 *   Midnight (rather than Tuesday evening) guarantees the window is already open when the Tuesday
 *   19:00 ET digest lands, so the pick link in that email always works.
 *
 * Never anchored on kickoff: the FR26 deadline always precedes kickoff, so a kickoff-gated open
 * instant is unreachable — that inversion is what silently forfeited 2026 Week 1.
 *
 * Schedule-only: this deliberately carries **no** `preSeasonInitializedAt` gate. Callers must keep
 * checking that themselves (see `computePicksUiIsPreview`) before treating a week as pickable.
 */
export function computePickWindowOpenUtc(args: {
  weekNumber: number;
  firstCompetitionWeek: number;
  allSeasonGames: { weekNumber: number; kickoffAt: Date }[];
}): Date | null {
  const { weekNumber, firstCompetitionWeek, allSeasonGames } = args;
  const firstKickoff = firstKickoffForWeek(allSeasonGames, weekNumber);
  if (firstKickoff == null) {
    return null;
  }
  if (weekNumber === firstCompetitionWeek) {
    return openLeadBeforeKickoff(firstKickoff, LEAGUE_BUSINESS_TIMEZONE);
  }

  const gameWeekStart = gameWeekStartUtc(firstKickoff, LEAGUE_BUSINESS_TIMEZONE);
  if (gameWeekStart.getTime() < computePickDeadlineUtc(firstKickoff).getTime()) {
    return gameWeekStart;
  }
  // FR26a requires the window to open strictly before the FR26 deadline. A week whose first kickoff
  // lands within `PICK_DEADLINE_LEAD_MINUTES` after Tuesday 00:00 ET would otherwise open at or
  // after its own lock and never be pickable, so fall back to the first-competition-week lead.
  return openLeadBeforeKickoff(firstKickoff, LEAGUE_BUSINESS_TIMEZONE);
}

/**
 * Preview banner: pre-season gates, schedule gaps, clamped FCW viewing, or before the FR26a
 * window-open instant of the **viewed** week.
 *
 * Evaluated per week, so a future week stays read-only preview even mid-season. Story 8.2: for test
 * leagues, preview ends when pre-season is initialized (simulation start), skipping the real-schedule
 * gate that would permanently block rehearsal before the NFL season.
 */
export function computePicksUiIsPreview(args: {
  season: { preSeasonInitializedAt: Date | null; firstCompetitionWeek: number } | null;
  resolvedWeekNumber: number;
  allSeasonGames: { weekNumber: number; kickoffAt: Date }[];
  now: Date;
  /** Defaults to `false` so existing production call sites stay byte-identical. */
  isTestLeague?: boolean;
}): boolean {
  const { season, resolvedWeekNumber, allSeasonGames, now, isTestLeague = false } = args;

  if (isTestLeague) {
    return !season?.preSeasonInitializedAt;
  }

  const fcw =
    typeof season?.firstCompetitionWeek === "number" ? season.firstCompetitionWeek : 1;

  if (!season?.preSeasonInitializedAt) {
    return true;
  }
  if (allSeasonGames.length === 0) {
    return true;
  }
  if (resolvedWeekNumber < fcw) {
    return true;
  }

  const windowOpen = computePickWindowOpenUtc({
    weekNumber: resolvedWeekNumber,
    firstCompetitionWeek: fcw,
    allSeasonGames,
  });
  if (windowOpen == null) {
    return true;
  }
  return now.getTime() < windowOpen.getTime();
}
