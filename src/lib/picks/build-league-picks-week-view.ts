import { Prisma } from "@prisma/client";

import { prisma as prismaSingleton } from "@/lib/db";
import { isSuperuserEmail } from "@/lib/auth/is-superuser";
import { fetchWeatherForGame } from "@/lib/integrations/weather/client";
import { getStadiumRoof } from "@/lib/integrations/weather/stadium-locations";
import type { WeatherData } from "@/lib/integrations/weather/client";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import {
  computePickDeadlineUtc,
  getFirstKickoffUtc,
} from "@/lib/domain/pick-deadline";
import { getEffectiveOddsLinesForLeague } from "@/lib/nfl/effective-odds";
import { getJailedTeamIdForLeagueWeek } from "@/lib/nfl/league-jailed";
import {
  getLiveDisplayOddsLinesForWeek,
  mergeLiveDisplayOddsOverEffective,
  shouldUseLiveDisplayOdds,
} from "@/lib/nfl/live-display-odds";
import {
  resolveGamesForLeague,
  resolveGamesForLeagueWithTeams,
} from "@/lib/nfl/resolve-games-for-league";
import {
  computePicksUiIsPreview,
  resolveActiveWeekNumber,
} from "@/lib/nfl/resolve-picks-week";
import type { MinimalNflGameForPicksWeek, MinimalSeasonForPicksWeek } from "@/lib/nfl/resolve-picks-week";
import { mapCurrentPick, mapSeasonPickedTeams } from "@/lib/picks/map-current-pick";
import type { PicksWeekMatchupJson, PicksWeekViewPayload } from "@/lib/picks/picks-week-view-types";
import { teamsOnBye } from "@/lib/picks/teams-on-bye";

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

  const user = await db.user.findUnique({
    where: { id: sessionUserId },
    select: { email: true },
  });
  const superuserViewer = isSuperuserEmail(user?.email);

  const membership = await db.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: sessionUserId, leagueId } },
  });

  if (!superuserViewer && (!membership || !isLeagueParticipantRole(membership.role))) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "League membership as a participant (admin or member) is required to view picks data",
    };
  }

  const [season, leagueRow] = await Promise.all([
    resolveCurrentSeasonForLeague(db.season, leagueId),
    db.league.findUnique({
      where: { id: leagueId },
      select: { isTestLeague: true },
    }),
  ]);

  if (!season) {
    return {
      ok: false,
      status: 404,
      code: "SEASON_NOT_FOUND",
      message: "No season exists for this league and the current NFL season year",
    };
  }

  const isTestLeague = leagueRow?.isTestLeague ?? false;
  const nflSeasonYear = season.nflSeasonYear;

  const minimalGames = await resolveGamesForLeague(db, {
    leagueId,
    nflSeasonYear,
    isTestLeague,
  });

  const gamesForResolve: MinimalNflGameForPicksWeek[] = minimalGames
    .filter((g): g is typeof g & { kickoffAt: Date } => g.kickoffAt != null)
    .map((g) => ({ weekNumber: g.weekNumber, kickoffAt: g.kickoffAt }));

  const seasonForResolve: MinimalSeasonForPicksWeek = {
    preSeasonInitializedAt: season.preSeasonInitializedAt,
    firstCompetitionWeek: season.firstCompetitionWeek,
    simulatedCurrentWeek: season.simulatedCurrentWeek,
  };

  const resolvedWeek = resolveActiveWeekNumber({
    isTestLeague,
    season: seasonForResolve,
    gamesForYear: gamesForResolve,
    now,
  });
  const targetWeek =
    explicitWeekNumber != null && explicitWeekNumber > 0 ? explicitWeekNumber : resolvedWeek;

  const gamesForWeek = await resolveGamesForLeagueWithTeams(db, {
    leagueId,
    nflSeasonYear,
    weekNumber: targetWeek,
    isTestLeague,
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
    isTestLeague,
  });

  const effectiveOdds = await getEffectiveOddsLinesForLeague(db, {
    leagueId,
    nflSeasonYear,
    weekNumber: targetWeek,
    isTestLeague,
  });
  const baselineDisplayOdds = new Map(
    [...effectiveOdds.entries()].map(([gameId, line]) => [
      gameId,
      {
        homeMoneylineAmerican: line.homeMoneylineAmerican,
        awayMoneylineAmerican: line.awayMoneylineAmerican,
        homeSpreadPoints: spreadToNullableNumber(line.homeSpreadPoints),
      },
    ]),
  );

  // Current week only (not past `?weekNumber=`), non-test leagues: overlay live
  // provider lines for display. Never persists; never touches jailed.
  let oddsLines = baselineDisplayOdds;
  if (
    shouldUseLiveDisplayOdds({
      isTestLeague,
      targetWeek,
      resolvedWeek,
    })
  ) {
    const live = await getLiveDisplayOddsLinesForWeek({
      nflSeasonYear,
      weekNumber: targetWeek,
      games: gamesForWeek.map((g) => ({
        id: g.id,
        homeTeamName: g.homeTeam.name,
        awayTeamName: g.awayTeam.name,
      })),
    });
    oddsLines = mergeLiveDisplayOddsOverEffective(baselineDisplayOdds, live);
  }

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

  const jailedTeamId = await getJailedTeamIdForLeagueWeek(db, {
    leagueId,
    nflSeasonYear,
    weekNumber: targetWeek,
    isTestLeague,
  });

  // Story 3.7 — caller's own pick context. Superuser viewers have no pick slot.
  const playerMembershipId = superuserViewer ? null : membership?.id ?? null;
  const [currentPickRow, otherWeekPickRows, catalogTeams] = await Promise.all([
    playerMembershipId
      ? db.pick.findUnique({
          where: {
            leagueMembershipId_seasonId_nflWeekNumber: {
              leagueMembershipId: playerMembershipId,
              seasonId: season.id,
              nflWeekNumber: targetWeek,
            },
          },
          select: { teamId: true, antiJailedBonus: true, updatedAt: true },
        })
      : Promise.resolve(null),
    playerMembershipId
      ? db.pick.findMany({
          where: {
            leagueMembershipId: playerMembershipId,
            seasonId: season.id,
            nflWeekNumber: { not: targetWeek },
          },
          select: { teamId: true, nflWeekNumber: true },
          orderBy: { nflWeekNumber: "asc" },
        })
      : Promise.resolve([]),
    db.team.findMany({
      select: { id: true, abbreviation: true, name: true },
    }),
  ]);

  const firstKickoff = getFirstKickoffUtc(gamesForWeek);
  const pickDeadlineUtc =
    firstKickoff != null ? computePickDeadlineUtc(firstKickoff).toISOString() : null;

  const gamesWithKickoff = gamesForWeek.filter(
    (g): g is typeof g & { kickoffAt: Date } => g.kickoffAt != null,
  );

  const matchups: PicksWeekMatchupJson[] = gamesWithKickoff.map((g) => {
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
      homeSpreadPoints: line?.homeSpreadPoints ?? null,
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
      jailedTeamId: jailedTeamId,
      matchups,
      teamsOnBye: teamsOnBye(catalogTeams, gamesWithKickoff),
      currentPick: mapCurrentPick(currentPickRow),
      seasonPickedTeams: mapSeasonPickedTeams(otherWeekPickRows),
    },
  };
}
