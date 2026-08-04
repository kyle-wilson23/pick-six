import {
  theOddsApiOddsResponseSchema,
  theOddsApiScheduleEventsResponseSchema,
  theOddsApiScoresResponseSchema,
} from "./schemas";

const SPORT = "americanfootball_nfl";
const BASE = `https://api.the-odds-api.com/v4/sports/${SPORT}`;

export class TheOddsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodySnippet?: string,
  ) {
    super(message);
    this.name = "TheOddsApiError";
  }
}

async function fetchJson(url: URL): Promise<{ status: number; text: string; json: unknown }> {
  const res = await fetch(url.toString(), {
    method: "GET",
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new TheOddsApiError(`The Odds API HTTP ${res.status}`, res.status, text.slice(0, 500));
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new TheOddsApiError("The Odds API returned non-JSON", res.status, text.slice(0, 200));
  }
  return { status: res.status, text, json };
}

/**
 * Fetches current NFL odds (moneyline + spreads) from The Odds API. **Server-only** — pass `apiKey` from env.
 */
export async function fetchAmericanFootballNflOdds(
  apiKey: string,
): Promise<ReturnType<typeof theOddsApiOddsResponseSchema.parse>> {
  const url = new URL(`${BASE}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h,spreads");
  url.searchParams.set("oddsFormat", "american");

  const { status, text, json } = await fetchJson(url);
  const parsed = theOddsApiOddsResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new TheOddsApiError("The Odds API payload failed validation", status, text.slice(0, 300));
  }

  console.info(
    JSON.stringify({
      action: "the_odds_api_nfl_odds_response",
      httpStatus: status,
      bodyChars: text.length,
      eventCount: parsed.data.length,
    }),
  );

  if (process.env.ODDS_API_DEBUG_LOG_RESPONSE === "true") {
    console.info("the_odds_api_nfl_odds_response_body", text);
  }

  return parsed.data;
}

/**
 * Quota-free NFL schedule events (`home_team` / `away_team` / `commence_time`). **Server-only**.
 */
export async function fetchAmericanFootballNflEvents(
  apiKey: string,
): Promise<ReturnType<typeof theOddsApiScheduleEventsResponseSchema.parse>> {
  const url = new URL(`${BASE}/events`);
  url.searchParams.set("apiKey", apiKey);

  const { status, text, json } = await fetchJson(url);
  const parsed = theOddsApiScheduleEventsResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new TheOddsApiError("The Odds API events payload failed validation", status, text.slice(0, 300));
  }

  console.info(
    JSON.stringify({
      action: "the_odds_api_nfl_events_response",
      httpStatus: status,
      bodyChars: text.length,
      eventCount: parsed.data.length,
    }),
  );

  return parsed.data;
}

/**
 * NFL scores for live + recently completed games. `daysFrom` max 3 per provider. **Server-only**.
 */
export async function fetchAmericanFootballNflScores(
  apiKey: string,
  opts: { daysFrom: 1 | 2 | 3 } = { daysFrom: 3 },
): Promise<ReturnType<typeof theOddsApiScoresResponseSchema.parse>> {
  const url = new URL(`${BASE}/scores`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("daysFrom", String(opts.daysFrom));

  const { status, text, json } = await fetchJson(url);
  const parsed = theOddsApiScoresResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new TheOddsApiError("The Odds API scores payload failed validation", status, text.slice(0, 300));
  }

  console.info(
    JSON.stringify({
      action: "the_odds_api_nfl_scores_response",
      httpStatus: status,
      bodyChars: text.length,
      eventCount: parsed.data.length,
      daysFrom: opts.daysFrom,
    }),
  );

  return parsed.data;
}
