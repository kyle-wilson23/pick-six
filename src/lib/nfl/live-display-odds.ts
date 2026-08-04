import { fetchAmericanFootballNflOdds } from "@/lib/integrations/the-odds-api/client";
import type { ExtractedOddsLine } from "@/lib/integrations/the-odds-api/extract-lines";
import {
  matchTheOddsEventsToGames,
  type NflGameForOddsMatch,
} from "@/lib/nfl/match-the-odds-events";

/** In-memory TTL so picks SSR does not burn Odds API credits per request. */
export const LIVE_DISPLAY_ODDS_TTL_MS = 30 * 60 * 1000;

export type DisplayOddsLine = {
  homeMoneylineAmerican: number | null;
  awayMoneylineAmerican: number | null;
  homeSpreadPoints: number | null;
};

type CompleteDisplayLine = {
  homeMoneylineAmerican: number;
  awayMoneylineAmerican: number;
  homeSpreadPoints: number;
};

type CacheEntry = {
  expiresAt: number;
  value: Map<string, CompleteDisplayLine>;
};

const liveOddsCache = new Map<string, CacheEntry>();
const liveOddsInflight = new Map<string, Promise<Map<string, CompleteDisplayLine> | null>>();

function cacheKey(nflSeasonYear: number, weekNumber: number): string {
  return `${nflSeasonYear}:${weekNumber}`;
}

function isCompleteLine(line: ExtractedOddsLine): line is CompleteDisplayLine {
  return (
    line.homeMoneylineAmerican !== null &&
    line.awayMoneylineAmerican !== null &&
    line.homeSpreadPoints !== null
  );
}

/** Pure gate: live overlay only for non-test leagues on the active week. */
export function shouldUseLiveDisplayOdds(input: {
  isTestLeague: boolean;
  targetWeek: number;
  resolvedWeek: number;
}): boolean {
  return !input.isTestLeague && input.targetWeek === input.resolvedWeek;
}

/** Test-only: clear module cache between cases. */
export function clearLiveDisplayOddsCacheForTests(): void {
  liveOddsCache.clear();
  liveOddsInflight.clear();
}

/**
 * Fetch current provider odds and map onto the week's games for **display only**.
 * Does not write `OddsSnapshotRun` / `NflGameOddsLine`. Never throws.
 *
 * Returns `null` when the API key is missing, the provider call fails, or no
 * **complete** lines match (caller should keep DB effective odds). Incomplete
 * provider rows are dropped (same completeness bar as Tuesday snapshot persist).
 */
export async function getLiveDisplayOddsLinesForWeek(input: {
  nflSeasonYear: number;
  weekNumber: number;
  games: NflGameForOddsMatch[];
}): Promise<Map<string, CompleteDisplayLine> | null> {
  const apiKey = process.env.ODDS_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  if (input.games.length === 0) {
    return null;
  }

  const key = cacheKey(input.nflSeasonYear, input.weekNumber);
  const cached = liveOddsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existingInflight = liveOddsInflight.get(key);
  if (existingInflight) {
    return existingInflight;
  }

  const promise = (async () => {
    try {
      const events = await fetchAmericanFootballNflOdds(apiKey);
      const matched = matchTheOddsEventsToGames(events, input.games);
      const complete = new Map<string, CompleteDisplayLine>();
      for (const [gameId, line] of matched) {
        if (isCompleteLine(line)) {
          complete.set(gameId, line);
        }
      }

      if (complete.size === 0) {
        console.warn(
          JSON.stringify({
            action: "live_display_odds_no_complete_matches",
            nflSeasonYear: input.nflSeasonYear,
            weekNumber: input.weekNumber,
            eventCount: events.length,
            matchedGames: matched.size,
            totalGames: input.games.length,
          }),
        );
        return null;
      }

      liveOddsCache.set(key, {
        expiresAt: Date.now() + LIVE_DISPLAY_ODDS_TTL_MS,
        value: complete,
      });
      console.info(
        JSON.stringify({
          action: "live_display_odds_fetched",
          nflSeasonYear: input.nflSeasonYear,
          weekNumber: input.weekNumber,
          eventCount: events.length,
          matchedGames: complete.size,
          totalGames: input.games.length,
        }),
      );
      return complete;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error(
        JSON.stringify({
          action: "live_display_odds_failed",
          nflSeasonYear: input.nflSeasonYear,
          weekNumber: input.weekNumber,
          error: msg,
        }),
      );
      return null;
    } finally {
      liveOddsInflight.delete(key);
    }
  })();

  liveOddsInflight.set(key, promise);
  return promise;
}

/**
 * Overlay complete live lines onto DB effective lines. Unmatched games and
 * null live fields keep the baseline (fail-soft).
 */
export function mergeLiveDisplayOddsOverEffective(
  baseline: Map<string, DisplayOddsLine>,
  live: Map<string, ExtractedOddsLine> | null,
): Map<string, DisplayOddsLine> {
  if (!live || live.size === 0) {
    return baseline;
  }
  const out = new Map(baseline);
  for (const [gameId, line] of live) {
    if (!isCompleteLine(line)) {
      continue;
    }
    const prev = out.get(gameId);
    out.set(gameId, {
      homeMoneylineAmerican: line.homeMoneylineAmerican ?? prev?.homeMoneylineAmerican ?? null,
      awayMoneylineAmerican: line.awayMoneylineAmerican ?? prev?.awayMoneylineAmerican ?? null,
      homeSpreadPoints: line.homeSpreadPoints ?? prev?.homeSpreadPoints ?? null,
    });
  }
  return out;
}
