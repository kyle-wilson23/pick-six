/**
 * Pure pick validation (Story 3.4). Route handlers load DB rows and call these with plain ids.
 */

export type NflGameTeamPair = {
  homeTeamId: string;
  awayTeamId: string;
};

export type PickDomainErrorCode =
  | "JAILED_TEAM_PICK"
  | "ANTI_JAILED_BONUS_INVALID"
  | "TEAM_NOT_IN_WEEK"
  | "JAILED_NOT_IN_WEEK_GAMES"
  | "DUPLICATE_TEAM";

export type PickDomainError = {
  code: PickDomainErrorCode;
  message: string;
};

export function teamPlaysInWeek(teamId: string, games: NflGameTeamPair[]): boolean {
  return games.some((g) => g.homeTeamId === teamId || g.awayTeamId === teamId);
}

/**
 * Returns the opponent of `jailedTeamId` in the same game, if that team appears in the week.
 */
export function getOpponentOfJailedInWeek(
  jailedTeamId: string,
  games: NflGameTeamPair[],
): { ok: true; opponentTeamId: string } | { ok: false } {
  for (const g of games) {
    if (g.homeTeamId === jailedTeamId) {
      return { ok: true, opponentTeamId: g.awayTeamId };
    }
    if (g.awayTeamId === jailedTeamId) {
      return { ok: true, opponentTeamId: g.homeTeamId };
    }
  }
  return { ok: false };
}

export type JailedAndLineupInput = {
  teamId: string;
  jailedTeamId: string;
  antiJailedBonus: boolean;
  games: NflGameTeamPair[];
};

/**
 * - Rejects picking the jailed team.
 * - If `antiJailedBonus` is true, `teamId` must be the jailed team’s opponent that week.
 * - `teamId` must be home or away in some game in `games`.
 */
export function validateJailedLineupAndBonus(input: JailedAndLineupInput): { ok: true } | { ok: false; error: PickDomainError } {
  const { teamId, jailedTeamId, antiJailedBonus, games } = input;

  if (teamId === jailedTeamId) {
    return {
      ok: false,
      error: {
        code: "JAILED_TEAM_PICK",
        message: "You cannot pick the jailed favorite for this week.",
      },
    };
  }

  if (!teamPlaysInWeek(teamId, games)) {
    return {
      ok: false,
      error: {
        code: "TEAM_NOT_IN_WEEK",
        message: "That team does not play in this NFL week.",
      },
    };
  }

  const opponent = getOpponentOfJailedInWeek(jailedTeamId, games);
  if (!opponent.ok) {
    return {
      ok: false,
      error: {
        code: "JAILED_NOT_IN_WEEK_GAMES",
        message: "Jailed team is not on the schedule for this week (data may be out of date).",
      },
    };
  }

  if (antiJailedBonus && teamId !== opponent.opponentTeamId) {
    return {
      ok: false,
      error: {
        code: "ANTI_JAILED_BONUS_INVALID",
        message: "Anti-jailed bonus only applies when picking the jailed team’s opponent in that game.",
      },
    };
  }

  return { ok: true };
}

/**
 * @param otherWeekTeamIds — `teamId` values already used in **other** weeks (same season + membership),
 *   excluding the target week.
 */
export function validateDuplicateTeamAcrossSeason(
  teamId: string,
  otherWeekTeamIds: Iterable<string>,
): { ok: true } | { ok: false; error: PickDomainError } {
  for (const t of otherWeekTeamIds) {
    if (t === teamId) {
      return {
        ok: false,
        error: {
          code: "DUPLICATE_TEAM",
          message: "You already used this team in another week this season.",
        },
      };
    }
  }
  return { ok: true };
}
