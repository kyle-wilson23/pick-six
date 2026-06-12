import type { NflGameStatus } from "@prisma/client";

import {
  includeRegularSeasonRow,
  parseWeekNumber,
  resolveTeamId,
  type TeamLookup,
} from "./map-schedule";
import type { ApiSportsGameRow } from "./schemas";

export type NflGameResultUpdate = {
  nflSeasonYear: number;
  weekNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  status: NflGameStatus;
  /** When undefined, sync must not overwrite existing scores (NS / SCHEDULED rows). */
  homeScore?: number | null;
  /** When undefined, sync must not overwrite existing scores (NS / SCHEDULED rows). */
  awayScore?: number | null;
};

export type ResultMapError = { message: string; context: Record<string, unknown> };

const IN_PROGRESS_CODES = new Set(["Q1", "Q2", "HT", "Q3", "Q4", "OT", "P"]);
const CANCELLED_CODES = new Set(["POST", "CANC"]);

export function mapApiSportsStatusShortToNflGameStatus(statusShort: string | undefined): NflGameStatus {
  const code = statusShort?.trim().toUpperCase() ?? "";
  if (code === "NS") return "SCHEDULED";
  if (code === "FT") return "FINAL";
  if (CANCELLED_CODES.has(code)) return "CANCELLED";
  if (IN_PROGRESS_CODES.has(code)) return "IN_PROGRESS";
  return "IN_PROGRESS";
}

function parseScoreTotal(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  return Math.trunc(value);
}

export function mapApiSportsRowToResultUpdate(
  row: ApiSportsGameRow,
  nflSeasonYear: number,
  lookup: TeamLookup,
): { ok: true; update: NflGameResultUpdate } | { ok: false; error: ResultMapError } {
  const weekNum = parseWeekNumber(row.game.week);
  if (!includeRegularSeasonRow(row.game.stage, weekNum)) {
    return {
      ok: false,
      error: {
        message: "non_regular_season_row",
        context: { providerGameId: row.game.id, stage: row.game.stage ?? null, week: row.game.week ?? null },
      },
    };
  }

  const home = resolveTeamId(row.teams.home, lookup);
  if (!home.ok) {
    return {
      ok: false,
      error: {
        message: `Unknown home team: ${home.reason}`,
        context: { providerGameId: row.game.id, side: "home", ...home.context },
      },
    };
  }
  const away = resolveTeamId(row.teams.away, lookup);
  if (!away.ok) {
    return {
      ok: false,
      error: {
        message: `Unknown away team: ${away.reason}`,
        context: { providerGameId: row.game.id, side: "away", ...away.context },
      },
    };
  }

  const statusShort = row.game.status?.short;
  const status = mapApiSportsStatusShortToNflGameStatus(statusShort);
  const homeScoreRaw = parseScoreTotal(row.scores?.home?.total);
  const awayScoreRaw = parseScoreTotal(row.scores?.away?.total);

  const base: NflGameResultUpdate = {
    nflSeasonYear,
    weekNumber: weekNum!,
    homeTeamId: home.teamId,
    awayTeamId: away.teamId,
    status,
  };

  if (status === "SCHEDULED") {
    return { ok: true, update: base };
  }

  if (status === "CANCELLED") {
    return { ok: true, update: { ...base, homeScore: null, awayScore: null } };
  }

  return {
    ok: true,
    update: {
      ...base,
      ...(homeScoreRaw !== null ? { homeScore: homeScoreRaw } : {}),
      ...(awayScoreRaw !== null ? { awayScore: awayScoreRaw } : {}),
    },
  };
}

/**
 * Maps validated API rows to result updates. Unmatched teams return structured errors (no throw).
 */
export function mapApiSportsRowsToResultUpdates(
  rows: ApiSportsGameRow[],
  nflSeasonYear: number,
  lookup: TeamLookup,
  opts?: { weekNumber?: number },
): { updates: NflGameResultUpdate[]; errors: ResultMapError[] } {
  const errors: ResultMapError[] = [];
  const deduped = new Map<string, NflGameResultUpdate>();

  for (const row of rows) {
    const mapped = mapApiSportsRowToResultUpdate(row, nflSeasonYear, lookup);
    if (!mapped.ok) {
      if (mapped.error.message === "non_regular_season_row") continue;
      errors.push(mapped.error);
      continue;
    }

    const update = mapped.update;
    if (opts?.weekNumber != null && update.weekNumber !== opts.weekNumber) continue;

    const key = `${update.nflSeasonYear}|${update.weekNumber}|${update.homeTeamId}|${update.awayTeamId}`;
    deduped.set(key, update);
  }

  return { updates: [...deduped.values()], errors };
}

/** Weeks containing at least one provider row with status FT (for season-wide sync scope). */
export function weeksWithCompletedGames(rows: ApiSportsGameRow[]): Set<number> {
  const weeks = new Set<number>();
  for (const row of rows) {
    const short = row.game.status?.short?.trim().toUpperCase();
    if (short !== "FT") continue;
    const weekNum = parseWeekNumber(row.game.week);
    if (weekNum != null) weeks.add(weekNum);
  }
  return weeks;
}
