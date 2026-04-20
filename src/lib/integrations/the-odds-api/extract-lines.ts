import type { TheOddsApiEvent } from "./schemas";

export type ExtractedOddsLine = {
  homeMoneylineAmerican: number | null;
  awayMoneylineAmerican: number | null;
  /** Spread from home team perspective (negative = home favored). */
  homeSpreadPoints: number | null;
};

function pickFirstBookmaker(event: TheOddsApiEvent) {
  return event.bookmakers[0] ?? null;
}

/**
 * Uses the first bookmaker’s **h2h** and **spreads** markets when present.
 * Missing market → null fields (caller may reject partial rows).
 */
export function extractLineFromTheOddsApiEvent(event: TheOddsApiEvent): ExtractedOddsLine {
  const bm = pickFirstBookmaker(event);
  if (!bm) {
    return { homeMoneylineAmerican: null, awayMoneylineAmerican: null, homeSpreadPoints: null };
  }

  const h2h = bm.markets.find((m) => m.key === "h2h");
  const spreads = bm.markets.find((m) => m.key === "spreads");

  let homeMoneylineAmerican: number | null = null;
  let awayMoneylineAmerican: number | null = null;

  if (h2h) {
    for (const o of h2h.outcomes) {
      if (o.name === event.home_team) {
        homeMoneylineAmerican = o.price;
      } else if (o.name === event.away_team) {
        awayMoneylineAmerican = o.price;
      }
    }
  }

  let homeSpreadPoints: number | null = null;
  if (spreads) {
    for (const o of spreads.outcomes) {
      if (o.name === event.home_team && o.point !== undefined) {
        homeSpreadPoints = o.point;
        break;
      }
    }
  }

  return { homeMoneylineAmerican, awayMoneylineAmerican, homeSpreadPoints };
}
