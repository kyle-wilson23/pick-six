import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { ScheduleUpsertInput } from "@/lib/integrations/api-sports-nfl/map-schedule";
import { buildTeamLookup } from "@/lib/integrations/api-sports-nfl/map-schedule";
import { canonicalTeamDisplayName } from "@/lib/integrations/the-odds-api/team-names";
import type { TheOddsApiScheduleEvent } from "@/lib/integrations/the-odds-api/schemas";
import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";
import {
  NFL_REGULAR_SEASON_WEEK_MAX,
  NFL_REGULAR_SEASON_WEEK_MIN,
} from "@/lib/nfl/nfl-regular-season";

export type ScheduleMapError = { message: string; context: Record<string, unknown> };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Tuesday 00:00 America/New_York for the ET calendar week that contains `anchorKickoff`.
 * ISO weekday: 1=Mon … 7=Sun; Tuesday = 2.
 */
export function week1TuesdayEtMs(anchorKickoff: Date): number {
  const ymd = formatInTimeZone(anchorKickoff, LEAGUE_BUSINESS_TIMEZONE, "yyyy-MM-dd");
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const noon = fromZonedTime(new Date(y!, m! - 1, d!, 12, 0, 0), LEAGUE_BUSINESS_TIMEZONE);
  const isoDow = Number.parseInt(formatInTimeZone(noon, LEAGUE_BUSINESS_TIMEZONE, "i"), 10);
  // Days since Tuesday in the same ET week (Tue=0 … Mon=6)
  const daysSinceTuesday = (isoDow + 5) % 7;
  const tuesdayYmd = formatInTimeZone(
    new Date(noon.getTime() - daysSinceTuesday * MS_PER_DAY),
    LEAGUE_BUSINESS_TIMEZONE,
    "yyyy-MM-dd",
  );
  const [ty, tm, td] = tuesdayYmd.split("-").map((x) => parseInt(x, 10));
  return fromZonedTime(new Date(ty!, tm! - 1, td!, 0, 0, 0), LEAGUE_BUSINESS_TIMEZONE).getTime();
}

/**
 * Infer NFL week 1–18 from kickoff relative to week-1 Tuesday 00:00 ET.
 * Returns null when outside the regular-season week range.
 */
export function inferNflWeekNumber(kickoffAt: Date, week1TuesdayMs: number): number | null {
  const deltaMs = kickoffAt.getTime() - week1TuesdayMs;
  if (!Number.isFinite(deltaMs)) return null;
  const week = 1 + Math.floor(deltaMs / (7 * MS_PER_DAY));
  if (week < NFL_REGULAR_SEASON_WEEK_MIN || week > NFL_REGULAR_SEASON_WEEK_MAX) {
    return null;
  }
  return week;
}

function resolveTeamIdByName(
  rawName: string,
  lookup: ReturnType<typeof buildTeamLookup>,
): string | null {
  const canonical = canonicalTeamDisplayName(rawName);
  if (!canonical) return null;
  return lookup.byCanonicalNameLower.get(canonical.trim().toLowerCase()) ?? null;
}

/**
 * Map Odds `/events` rows to schedule upserts. Fails entirely if any event has an unknown team
 * or missing kickoff (no partial season commit).
 */
export function mapOddsEventsToScheduleUpserts(
  events: TheOddsApiScheduleEvent[],
  nflSeasonYear: number,
  teams: { id: string; abbreviation: string; name: string }[],
): { ok: true; rows: ScheduleUpsertInput[] } | { ok: false; errors: ScheduleMapError[] } {
  const lookup = buildTeamLookup(teams);
  const errors: ScheduleMapError[] = [];
  const withKickoff: Array<{
    homeTeamId: string;
    awayTeamId: string;
    kickoffAt: Date;
  }> = [];

  // NFL season label year Y: roughly Aug Y … Feb Y+1 (UTC bounds; week inference does ET detail).
  const seasonStart = Date.UTC(nflSeasonYear, 7, 1); // Aug 1
  const seasonEnd = Date.UTC(nflSeasonYear + 1, 2, 1); // Mar 1 next calendar year

  for (const event of events) {
    const kickoffAt = new Date(event.commence_time);
    if (Number.isNaN(kickoffAt.getTime())) {
      errors.push({
        message: "invalid_commence_time",
        context: { eventId: event.id, commence_time: event.commence_time },
      });
      continue;
    }
    const t = kickoffAt.getTime();
    if (t < seasonStart || t >= seasonEnd) {
      // Drop out-of-season / wrong-year events rather than failing the whole sync.
      continue;
    }
    const homeTeamId = resolveTeamIdByName(event.home_team, lookup);
    const awayTeamId = resolveTeamIdByName(event.away_team, lookup);
    if (!homeTeamId || !awayTeamId) {
      errors.push({
        message: "unknown_team",
        context: {
          eventId: event.id,
          home_team: event.home_team,
          away_team: event.away_team,
          homeResolved: !!homeTeamId,
          awayResolved: !!awayTeamId,
        },
      });
      continue;
    }
    if (homeTeamId === awayTeamId) {
      errors.push({
        message: "same_home_away",
        context: { eventId: event.id, teamId: homeTeamId },
      });
      continue;
    }
    withKickoff.push({ homeTeamId, awayTeamId, kickoffAt });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (withKickoff.length === 0) {
    return { ok: true, rows: [] };
  }

  withKickoff.sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
  const week1Tue = week1TuesdayEtMs(withKickoff[0]!.kickoffAt);
  const deduped = new Map<string, ScheduleUpsertInput>();

  for (const g of withKickoff) {
    const weekNumber = inferNflWeekNumber(g.kickoffAt, week1Tue);
    if (weekNumber == null) continue;
    const key = `${nflSeasonYear}|${weekNumber}|${g.homeTeamId}|${g.awayTeamId}`;
    deduped.set(key, {
      nflSeasonYear,
      weekNumber,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      kickoffAt: g.kickoffAt,
    });
  }

  return { ok: true, rows: [...deduped.values()] };
}
