import { canonicalTeamDisplayName } from "@/lib/integrations/the-odds-api/team-names";

import type { ApiSportsGameDate, ApiSportsGameRow, ApiSportsTeamSide } from "./schemas";

/** Provider `code` → our `Team.abbreviation` (see `prisma/data/nfl-teams.json`). */
const PROVIDER_CODE_ALIASES: Record<string, string> = {
  JAC: "JAX",
  WSH: "WAS",
};

export type ScheduleUpsertInput = {
  nflSeasonYear: number;
  weekNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: Date;
};

export type TeamLookup = {
  byAbbrev: Map<string, string>;
  byCanonicalNameLower: Map<string, string>;
};

export function buildTeamLookup(teams: { id: string; abbreviation: string; name: string }[]): TeamLookup {
  const byAbbrev = new Map<string, string>();
  const byCanonicalNameLower = new Map<string, string>();
  for (const t of teams) {
    byAbbrev.set(t.abbreviation.trim().toUpperCase(), t.id);
    byCanonicalNameLower.set(t.name.trim().toLowerCase(), t.id);
  }
  return { byAbbrev, byCanonicalNameLower };
}

export function normalizeProviderTeamCode(code: string | undefined): string | null {
  if (!code?.trim()) return null;
  const upper = code.trim().toUpperCase();
  return PROVIDER_CODE_ALIASES[upper] ?? upper;
}

export function parseWeekNumber(week: unknown): number | null {
  if (week === null || week === undefined) return null;
  const n = typeof week === "number" ? week : parseInt(String(week).trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 18) return null;
  return n;
}

/**
 * Keep regular-season weeks 1–18. Allowlist: passes only when `stage` is explicitly "Regular Season" or absent.
 * Unknown stage strings (e.g. "Pro Bowl", "Hall of Fame") are dropped rather than silently included.
 */
export function includeRegularSeasonRow(stage: string | undefined, weekNum: number | null): boolean {
  if (weekNum === null) return false;
  if (stage == null || stage.trim() === "") return true;
  return stage.trim().toLowerCase() === "regular season";
}

export function kickoffUtcFromGameDate(gameDate: ApiSportsGameDate | undefined): Date | null {
  if (!gameDate) return null;
  if (gameDate.timestamp != null && Number.isFinite(gameDate.timestamp)) {
    const ts = gameDate.timestamp;
    const ms = ts > 1e12 ? ts : ts * 1000;
    return new Date(ms);
  }
  if (gameDate.date && gameDate.time) {
    const iso = `${gameDate.date}T${gameDate.time}:00.000Z`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // date-only rows have no reliable kickoff time — fail loudly so the sync surfaces missing_kickoff
  // rather than upsert a fabricated 12:00Z that would produce a wrong deadline lock (NFR24).
  return null;
}

export function resolveTeamId(
  side: ApiSportsTeamSide,
  lookup: TeamLookup,
): { ok: true; teamId: string } | { ok: false; reason: string; context: Record<string, unknown> } {
  const code = normalizeProviderTeamCode(side.code);
  if (code) {
    const id = lookup.byAbbrev.get(code);
    if (id) return { ok: true, teamId: id };
  }
  const rawName = side.name?.trim();
  if (rawName) {
    const canonical = canonicalTeamDisplayName(rawName);
    const label = (canonical ?? rawName).trim().toLowerCase();
    const id = lookup.byCanonicalNameLower.get(label);
    if (id) return { ok: true, teamId: id };
  }
  return {
    ok: false,
    reason: "unknown_team",
    context: {
      code: side.code ?? null,
      name: side.name ?? null,
    },
  };
}

export type ScheduleMapError = { message: string; context: Record<string, unknown> };

/**
 * Maps validated API rows to DB upsert inputs. Drops non-regular-season rows. De-duplicates on natural game key.
 */
export function mapApiSportsRowsToScheduleUpserts(
  rows: ApiSportsGameRow[],
  nflSeasonYear: number,
  lookup: TeamLookup,
): { ok: true; rows: ScheduleUpsertInput[] } | { ok: false; errors: ScheduleMapError[] } {
  const errors: ScheduleMapError[] = [];
  const deduped = new Map<string, ScheduleUpsertInput>();

  for (const row of rows) {
    const weekNum = parseWeekNumber(row.game.week);
    if (!includeRegularSeasonRow(row.game.stage, weekNum)) continue;

    const kickoffAt = kickoffUtcFromGameDate(row.game.date);
    if (!kickoffAt) {
      errors.push({
        message: "missing_kickoff",
        context: { providerGameId: row.game.id, week: row.game.week ?? null },
      });
      continue;
    }

    const home = resolveTeamId(row.teams.home, lookup);
    if (!home.ok) {
      errors.push({
        message: `Unknown home team: ${home.reason}`,
        context: { providerGameId: row.game.id, side: "home", ...home.context },
      });
      continue;
    }
    const away = resolveTeamId(row.teams.away, lookup);
    if (!away.ok) {
      errors.push({
        message: `Unknown away team: ${away.reason}`,
        context: { providerGameId: row.game.id, side: "away", ...away.context },
      });
      continue;
    }

    const rec: ScheduleUpsertInput = {
      nflSeasonYear,
      weekNumber: weekNum!,
      homeTeamId: home.teamId,
      awayTeamId: away.teamId,
      kickoffAt,
    };
    const key = `${rec.nflSeasonYear}|${rec.weekNumber}|${rec.homeTeamId}|${rec.awayTeamId}`;
    if (deduped.has(key)) {
      errors.push({
        message: "duplicate_game_key",
        context: { key, providerGameId: row.game.id },
      });
      continue;
    }
    deduped.set(key, rec);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, rows: [...deduped.values()] };
}
