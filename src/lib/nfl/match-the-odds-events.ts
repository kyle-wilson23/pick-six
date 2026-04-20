import type { TheOddsApiEvent } from "@/lib/integrations/the-odds-api/schemas";
import { canonicalTeamDisplayName } from "@/lib/integrations/the-odds-api/team-names";
import {
  extractLineFromTheOddsApiEvent,
  type ExtractedOddsLine,
} from "@/lib/integrations/the-odds-api/extract-lines";

export type NflGameForOddsMatch = {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
};

/**
 * Match provider events to `NflGame` rows by **full team display names** (home/away orientation must match).
 */
export function matchTheOddsEventsToGames(
  events: TheOddsApiEvent[],
  games: NflGameForOddsMatch[],
): Map<string, ExtractedOddsLine> {
  const byKey = new Map<string, TheOddsApiEvent>();
  for (const e of events) {
    const home = canonicalTeamDisplayName(e.home_team);
    const away = canonicalTeamDisplayName(e.away_team);
    if (!home || !away) continue;
    byKey.set(`${away}@@${home}`, e);
  }

  const out = new Map<string, ExtractedOddsLine>();
  for (const g of games) {
    const e = byKey.get(`${g.awayTeamName}@@${g.homeTeamName}`);
    if (!e) continue;
    out.set(g.id, extractLineFromTheOddsApiEvent(e));
  }
  return out;
}
