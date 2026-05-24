import { Prisma } from "@prisma/client";

import { prisma as prismaSingleton } from "@/lib/db";
import { fetchWeatherForGame } from "@/lib/integrations/weather/client";
import { getStadiumRoof } from "@/lib/integrations/weather/stadium-locations";
import type { WeatherData } from "@/lib/integrations/weather/client";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import {
  computePickDeadlineUtc,
  getFirstKickoffUtc,
} from "@/lib/domain/pick-deadline";
import { getEffectiveOddsLinesForWeek } from "@/lib/nfl/effective-odds";
import {
  computePicksUiIsPreview,
  resolvePicksWeekNumber,
} from "@/lib/nfl/resolve-picks-week";
import type { MinimalNflGameForPicksWeek, MinimalSeasonForPicksWeek } from "@/lib/nfl/resolve-picks-week";
import { mapCurrentPick, mapSeasonPickedTeams } from "@/lib/picks/map-current-pick";
import type { PicksWeekMatchupJson, PicksWeekViewPayload } from "@/lib/picks/picks-week-view-types";

type Err = { ok: false; status: number; code: string; message: string };
type Ok = { ok: true; payload: PicksWeekViewPayload };
export type BuildLeaguePicksWeekViewOutcome = Err | Ok;

function spreadToNullableNumber(value: Prisma.Decimal | null): number | null {
  if (value == null) {
    return null;
  }
  return value.toNumber();
}

export async function buildLeaguePicksWeekView(
  args: {
    leagueId: string;
    sessionUserId: string;
    /** If set (e.g. from `?weekNumber=`), **400** when that week has no games in DB. Omit to use resolver. */
    explicitWeekNumber: number | null;
  },
  now: Date = new Date(),
): Promise<BuildLeaguePicksWeekViewOutcome> {
  const { leagueId, sessionUserId, explicitWeekNumber } = args;
  const db = prismaSingleton;

  const membership = await db.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: sessionUserId, leagueId } },
  });

  if (!membership || !isLeagueParticipantRole(membership.role)) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "League membership as a participant (admin or member) is required to view picks data",
    };
  }

  const season = await resolveCurrentSeasonForLeague(db.season, leagueId);

  if (!season) {
    return {
      ok: false,
      status: 404,
      code: "SEASON_NOT_FOUND",
      message: "No season exists for this league and the current NFL season year",
    };
  }

  const nflSeasonYear = season.nflSeasonYear;

  const minimalGames = await db.nflGame.findMany({
    where: { nflSeasonYear },
    select: {
      weekNumber: true,
      kickoffAt: true,
    },
  });

  const gamesForResolve: MinimalNflGameForPicksWeek[] = minimalGames
    .filter((g): g is { weekNumber: number; kickoffAt: Date } => g.kickoffAt != null)
    .map((g) => ({ weekNumber: g.weekNumber, kickoffAt: g.kickoffAt }));

  const seasonForResolve: MinimalSeasonForPicksWeek = {
    preSeasonInitializedAt: season.preSeasonInitializedAt,
    firstCompetitionWeek: season.firstCompetitionWeek,
  };

  const resolvedWeek = resolvePicksWeekNumber(seasonForResolve, gamesForResolve, now);
  const targetWeek =
    explicitWeekNumber != null && explicitWeekNumber > 0 ? explicitWeekNumber : resolvedWeek;

  const gamesForWeek = await db.nflGame.findMany({
    where: { nflSeasonYear, weekNumber: targetWeek },
    include: {
      homeTeam: { select: { id: true, abbreviation: true, name: true } },
      awayTeam: { select: { id: true, abbreviation: true, name: true } },
    },
    orderBy: { kickoffAt: "asc" },
  });

  if (explicitWeekNumber != null && gamesForWeek.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "GAMES_NOT_LOADED",
      message: "No game schedule data is available for this NFL week.",
    };
  }

  const isPreview = computePicksUiIsPreview({
    season,
    resolvedWeekNumber: targetWeek,
    allSeasonGames: gamesForResolve,
    now,
  });

  const oddsLines = await getEffectiveOddsLinesForWeek(db, nflSeasonYear, targetWeek);

  const weatherResults = await Promise.all(
    gamesForWeek
      .filter((g): g is typeof g & { kickoffAt: Date } => g.kickoffAt != null)
      .map(async (g) => ({
        abbreviation: g.homeTeam.abbreviation,
        weather: getStadiumRoof(g.homeTeam.abbreviation) === "dome"
          ? null
          : await fetchWeatherForGame(g.homeTeam.abbreviation, g.kickoffAt),
      })),
  );
  const weatherByHomeAbbrev = new Map<string, WeatherData>();
  for (const { abbreviation, weather } of weatherResults) {
    if (weather) {
      weatherByHomeAbbrev.set(abbreviation.toUpperCase(), weather);
    }
  }

  const jailedRow = await db.nflWeekJailedTeam.findUnique({
    where: {
      nflSeasonYear_weekNumber: { nflSeasonYear, weekNumber: targetWeek },
    },
    select: { jailedTeamId: true },
  });

  // Story 3.7 — caller's own pick context. Always filtered by `leagueMembershipId`; never returns
  // other participants' pick data (NFR17 / project-context #4).
  const [currentPickRow, otherWeekPickRows] = await Promise.all([
    db.pick.findUnique({
      where: {
        leagueMembershipId_seasonId_nflWeekNumber: {
          leagueMembershipId: membership.id,
          seasonId: season.id,
          nflWeekNumber: targetWeek,
        },
      },
      select: { teamId: true, antiJailedBonus: true, updatedAt: true },
    }),
    db.pick.findMany({
      where: {
        leagueMembershipId: membership.id,
        seasonId: season.id,
        nflWeekNumber: { not: targetWeek },
      },
      select: { teamId: true, nflWeekNumber: true },
      orderBy: { nflWeekNumber: "asc" },
    }),
  ]);

  const firstKickoff = getFirstKickoffUtc(gamesForWeek);
  const pickDeadlineUtc =
    firstKickoff != null ? computePickDeadlineUtc(firstKickoff).toISOString() : null;

  const matchups: PicksWeekMatchupJson[] = gamesForWeek
    .filter((g): g is typeof g & { kickoffAt: Date } => g.kickoffAt != null)
    .map((g) => {
    const line = oddsLines.get(g.id);
    const homeAbbrev = g.homeTeam.abbreviation.toUpperCase();
    const stadiumRoof = getStadiumRoof(g.homeTeam.abbreviation);
    return {
      gameId: g.id,
      kickoffAt: g.kickoffAt.toISOString(),
      homeTeam: {
        id: g.homeTeam.id,
        abbreviation: g.homeTeam.abbreviation,
        name: g.homeTeam.name,
      },
      awayTeam: {
        id: g.awayTeam.id,
        abbreviation: g.awayTeam.abbreviation,
        name: g.awayTeam.name,
      },
      homeMoneylineAmerican: line?.homeMoneylineAmerican ?? null,
      awayMoneylineAmerican: line?.awayMoneylineAmerican ?? null,
      homeSpreadPoints: spreadToNullableNumber(line?.homeSpreadPoints ?? null),
      weather: weatherByHomeAbbrev.get(homeAbbrev) ?? null,
      stadiumRoof,
    };
  });

  return {
    ok: true,
    payload: {
      weekNumber: targetWeek,
      isPreview,
      pickDeadlineUtc,
      jailedTeamId: jailedRow?.jailedTeamId ?? null,
      matchups,
      currentPick: mapCurrentPick(currentPickRow),
      seasonPickedTeams: mapSeasonPickedTeams(otherWeekPickRows),
    },
  };
}
