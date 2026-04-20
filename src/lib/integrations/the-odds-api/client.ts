import { theOddsApiOddsResponseSchema } from "./schemas";

const BASE = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds";

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

/**
 * Fetches current NFL odds (moneyline + spreads) from The Odds API. **Server-only** — pass `apiKey` from env.
 */
export async function fetchAmericanFootballNflOdds(apiKey: string): Promise<ReturnType<typeof theOddsApiOddsResponseSchema.parse>> {
  const url = new URL(BASE);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h,spreads");
  url.searchParams.set("oddsFormat", "american");

  const res = await fetch(url.toString(), { method: "GET", next: { revalidate: 0 } });
  const text = await res.text();
  if (!res.ok) {
    throw new TheOddsApiError(
      `The Odds API HTTP ${res.status}`,
      res.status,
      text.slice(0, 500),
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new TheOddsApiError("The Odds API returned non-JSON", res.status, text.slice(0, 200));
  }

  const parsed = theOddsApiOddsResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new TheOddsApiError("The Odds API payload failed validation", res.status, text.slice(0, 300));
  }

  console.info(
    JSON.stringify({
      action: "the_odds_api_nfl_odds_response",
      httpStatus: res.status,
      bodyChars: text.length,
      eventCount: parsed.data.length,
    }),
  );

  if (process.env.ODDS_API_DEBUG_LOG_RESPONSE === "true") {
    console.info("the_odds_api_nfl_odds_response_body", text);
  }

  return parsed.data;
}
