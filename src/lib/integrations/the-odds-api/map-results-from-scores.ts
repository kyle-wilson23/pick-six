import type { NflGameStatus } from "@prisma/client";

import { canonicalTeamDisplayName } from "@/lib/integrations/the-odds-api/team-names";
import type { TheOddsApiScoreEvent } from "@/lib/integrations/the-odds-api/schemas";
import { buildTeamLookup } from "@/lib/nfl/team-lookup";

export type OddsGameResultUpdate = {
  nflGameId: string;
  weekNumber: number;
  status: NflGameStatus;
  homeScore: number;
  awayScore: number;
};

export type OddsResultMapError = { message: string; context: Record<string, unknown> };

export type ExistingGameForOddsMatch = {
  id: string;
  weekNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: Date | null;
};

function parseScore(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function resolveTeamId(
  rawName: string,
  lookup: ReturnType<typeof buildTeamLookup>,
): string | null {
  const canonical = canonicalTeamDisplayName(rawName);
  if (!canonical) return null;
  return lookup.byCanonicalNameLower.get(canonical.trim().toLowerCase()) ?? null;
}

function scoreForTeam(
  event: TheOddsApiScoreEvent,
  teamName: string,
): number | null {
  const sides = event.scores ?? [];
  const canonical = canonicalTeamDisplayName(teamName)?.toLowerCase();
  for (const side of sides) {
    const sideCanon = canonicalTeamDisplayName(side.name)?.toLowerCase();
    if (sideCanon && canonical && sideCanon === canonical) {
      return parseScore(side.score);
    }
  }
  return null;
}

/**
 * Map Odds `/scores` completed events onto existing NflGame rows for a season.
 * Soft-skips unmatched events (errors list); successful updates returned separately.
 */
export function mapOddsScoresToResultUpdates(
  events: TheOddsApiScoreEvent[],
  games: ExistingGameForOddsMatch[],
  teams: { id: string; abbreviation: string; name: string }[],
  opts?: { weekNumber?: number },
): { updates: OddsGameResultUpdate[]; errors: OddsResultMapError[] } {
  const lookup = buildTeamLookup(teams);
  const byPair = new Map<string, ExistingGameForOddsMatch[]>();
  for (const g of games) {
    if (opts?.weekNumber != null && g.weekNumber !== opts.weekNumber) continue;
    const key = `${g.homeTeamId}|${g.awayTeamId}`;
    const list = byPair.get(key) ?? [];
    list.push(g);
    byPair.set(key, list);
  }

  const updates: OddsGameResultUpdate[] = [];
  const errors: OddsResultMapError[] = [];

  for (const event of events) {
    if (!event.completed) continue;

    const homeTeamId = resolveTeamId(event.home_team, lookup);
    const awayTeamId = resolveTeamId(event.away_team, lookup);
    if (!homeTeamId || !awayTeamId) {
      errors.push({
        message: "unknown_team",
        context: { eventId: event.id, home_team: event.home_team, away_team: event.away_team },
      });
      continue;
    }

    const homeScore = scoreForTeam(event, event.home_team);
    const awayScore = scoreForTeam(event, event.away_team);
    if (homeScore == null || awayScore == null) {
      errors.push({
        message: "missing_scores",
        context: { eventId: event.id },
      });
      continue;
    }

    const candidates = byPair.get(`${homeTeamId}|${awayTeamId}`) ?? [];
    if (candidates.length === 0) {
      errors.push({
        message: "no_matching_nfl_game",
        context: { eventId: event.id, homeTeamId, awayTeamId },
      });
      continue;
    }

    let match = candidates[0]!;
    if (candidates.length > 1) {
      const commence = new Date(event.commence_time).getTime();
      match = candidates.reduce((best, g) => {
        const bestDelta =
          best.kickoffAt != null ? Math.abs(best.kickoffAt.getTime() - commence) : Number.POSITIVE_INFINITY;
        const gDelta =
          g.kickoffAt != null ? Math.abs(g.kickoffAt.getTime() - commence) : Number.POSITIVE_INFINITY;
        return gDelta < bestDelta ? g : best;
      }, candidates[0]!);
    }

    updates.push({
      nflGameId: match.id,
      weekNumber: match.weekNumber,
      status: "FINAL",
      homeScore,
      awayScore,
    });
  }

  return { updates, errors };
}
